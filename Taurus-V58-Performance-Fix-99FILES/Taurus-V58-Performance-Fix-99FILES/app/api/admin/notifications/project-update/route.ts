import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isAdminRole } from "@/lib/roles";
import { getDefaultProjectId } from "@/lib/project";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, friendlyAdminError } from "@/lib/supabase/admin";
import {
  projectDashboardUrl,
  sendProjectUpdateEmail
} from "@/lib/notifications/project-update-email";

export const runtime = "nodejs";
export const maxDuration = 60;

type NotificationRequest = { expectedPublishedAt?: string };
type Recipient = { id: string; email: string };

export async function POST(request: Request) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!isAdminRole(actor.role)) {
    return NextResponse.json({ error: "Only a Super Admin or Project Administrator can notify project users." }, { status: 403 });
  }

  const projectId = getDefaultProjectId();
  if (!projectId) return NextResponse.json({ error: "DEFAULT_PROJECT_ID is not configured in Vercel." }, { status: 503 });

  const body = (await request.json().catch(() => null)) as NotificationRequest | null;

  // Read the published row with the signed-in session. Migration 0009 gives
  // every project member read access while keeping write access admin-only.
  const sessionClient = await createClient();
  const { data: update, error: updateError } = await sessionClient
    .from("published_project_updates")
    .select("id, data_date, published_at, progress_file_name, schedule_file_name")
    .eq("project_id", projectId)
    .maybeSingle();

  if (updateError) {
    return NextResponse.json({
      error: `${updateError.message}. Run supabase/migrations/0009_project_administrator_notifications.sql in Supabase SQL Editor.`
    }, { status: 500 });
  }
  if (!update?.published_at) return NextResponse.json({ error: "No published dashboard update is available to notify users about." }, { status: 409 });
  if (body?.expectedPublishedAt && body.expectedPublishedAt !== update.published_at) {
    return NextResponse.json({ error: "A newer dashboard update was published. Refresh the page before sending the notification." }, { status: 409 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (error) {
    return NextResponse.json({ error: friendlyAdminError(error) }, { status: 503 });
  }

  // Determine active project members server-side.
  const { data: members, error: membershipError } = await admin
    .from("project_members")
    .select("user_id")
    .eq("project_id", projectId);
  if (membershipError) return NextResponse.json({ error: friendlyAdminError(membershipError) }, { status: 500 });

  const memberIds = [...new Set((members ?? [])
    .map((member) => String(member.user_id))
    .filter((id) => id && id !== actor.id))];

  let activeIds = new Set<string>();
  if (memberIds.length) {
    const { data: profiles, error: profilesError } = await admin
      .from("profiles")
      .select("id")
      .in("id", memberIds)
      .eq("is_active", true);
    if (profilesError) return NextResponse.json({ error: friendlyAdminError(profilesError) }, { status: 500 });
    activeIds = new Set((profiles ?? []).map((profile) => String(profile.id)));
  }

  // IMPORTANT: recipients come from auth.users.email — the exact address used
  // to sign in — rather than a separately editable profile email field.
  const recipients: Recipient[] = [];
  if (activeIds.size) {
    for (let page = 1; page <= 10 && recipients.length < activeIds.size; page += 1) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) return NextResponse.json({ error: friendlyAdminError(error) }, { status: 500 });
      for (const authUser of data.users) {
        if (!activeIds.has(authUser.id)) continue;
        const email = String(authUser.email ?? "").trim().toLowerCase();
        if (/^\S+@\S+\.\S+$/.test(email)) recipients.push({ id: authUser.id, email });
      }
      if (data.users.length < 1000) break;
    }
  }

  if (!recipients.length) {
    return NextResponse.json({ sent: 0, failed: 0, total: 0, message: "There are no other active project users to notify." });
  }

  const dashboardUrl = projectDashboardUrl(request.url);
  const publishedKey = String(update.published_at).replace(/[^0-9A-Za-z]/g, "").slice(0, 40);
  const results: Array<{ email: string; ok: boolean; error?: string }> = [];

  // Parallel batches keep delivery quick while avoiding provider bursts.
  for (let start = 0; start < recipients.length; start += 10) {
    const batch = recipients.slice(start, start + 10);
    const batchResults = await Promise.all(batch.map(async (recipient) => {
      try {
        await sendProjectUpdateEmail({
          recipientEmail: recipient.email,
          administratorName: actor.fullName,
          dashboardUrl,
          dataDate: update.data_date ? String(update.data_date) : null,
          idempotencyKey: `taurus-${projectId}-${publishedKey}-${recipient.id}`
        });
        return { email: recipient.email, ok: true };
      } catch (error) {
        return { email: recipient.email, ok: false, error: error instanceof Error ? error.message : "Email delivery failed." };
      }
    }));
    results.push(...batchResults);
  }

  const sent = results.filter((result) => result.ok).length;
  const failures = results.filter((result) => !result.ok);

  // Audit logging is useful but must never make a successful email operation fail.
  void admin.from("audit_log").insert({
    actor_id: actor.id,
    event_type: failures.length ? "notification.project_update_partial" : "notification.project_update_sent",
    entity_type: "project_update",
    entity_id: String(update.id),
    project_id: projectId,
    details: {
      recipient_count: recipients.length,
      sent_count: sent,
      failed_count: failures.length,
      data_date: update.data_date,
      dashboard_url: dashboardUrl,
      files: [update.progress_file_name, update.schedule_file_name].filter(Boolean),
      actor_name: actor.fullName,
      actor_email: actor.email,
      recipient_source: "auth.users.email"
    }
  });

  if (!sent) {
    return NextResponse.json({
      error: failures[0]?.error || "Email notifications could not be delivered.",
      sent,
      failed: failures.length,
      total: recipients.length
    }, { status: 502 });
  }

  return NextResponse.json({
    sent,
    failed: failures.length,
    total: recipients.length,
    message: failures.length
      ? `${sent} notification(s) sent; ${failures.length} could not be delivered.`
      : `${sent} project user(s) notified successfully.`
  });
}
