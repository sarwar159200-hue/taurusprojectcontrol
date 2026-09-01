import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isAdminRole } from "@/lib/roles";
import { getDefaultProjectId } from "@/lib/project";
import { createAdminClient, friendlyAdminError } from "@/lib/supabase/admin";
import {
  projectDashboardUrl,
  sendProjectUpdateEmail
} from "@/lib/notifications/project-update-email";

export const runtime = "nodejs";
export const maxDuration = 60;

type NotificationRequest = { expectedPublishedAt?: string };

export async function POST(request: Request) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!isAdminRole(actor.role)) {
    return NextResponse.json({ error: "Only a Super Admin or Project Administrator can notify project users." }, { status: 403 });
  }

  const projectId = getDefaultProjectId();
  if (!projectId) return NextResponse.json({ error: "DEFAULT_PROJECT_ID is not configured in Vercel." }, { status: 503 });

  const body = (await request.json().catch(() => null)) as NotificationRequest | null;
  let admin;
  try {
    admin = createAdminClient();
  } catch (error) {
    return NextResponse.json({ error: friendlyAdminError(error) }, { status: 503 });
  }

  const { data: update, error: updateError } = await admin
    .from("published_project_updates")
    .select("id, data_date, published_at, published_by, progress_file_name, schedule_file_name")
    .eq("project_id", projectId)
    .maybeSingle();
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  if (!update?.published_at) return NextResponse.json({ error: "No published dashboard update is available to notify users about." }, { status: 409 });
  if (body?.expectedPublishedAt && body.expectedPublishedAt !== update.published_at) {
    return NextResponse.json({ error: "A newer dashboard update was published. Refresh the page before sending the notification." }, { status: 409 });
  }

  const { data: members, error: membershipError } = await admin
    .from("project_members")
    .select("user_id")
    .eq("project_id", projectId);
  if (membershipError) return NextResponse.json({ error: membershipError.message }, { status: 500 });

  const memberIds = [...new Set((members ?? []).map((member) => String(member.user_id)).filter((id) => id && id !== actor.id))];
  let recipients: Array<{ id: string; email: string; full_name: string }> = [];
  if (memberIds.length) {
    const { data: profiles, error: profilesError } = await admin
      .from("profiles")
      .select("id, email, full_name")
      .in("id", memberIds)
      .eq("is_active", true);
    if (profilesError) return NextResponse.json({ error: profilesError.message }, { status: 500 });
    recipients = (profiles ?? [])
      .map((profile) => ({ id: String(profile.id), email: String(profile.email ?? "").trim().toLowerCase(), full_name: String(profile.full_name ?? "") }))
      .filter((profile) => /^\S+@\S+\.\S+$/.test(profile.email));
  }

  if (!recipients.length) {
    await admin.from("audit_log").insert({
      actor_id: actor.id,
      event_type: "notification.project_update_sent",
      entity_type: "project_update",
      entity_id: String(update.id),
      project_id: projectId,
      details: { recipient_count: 0, sent_count: 0, failed_count: 0, data_date: update.data_date, actor_name: actor.fullName, actor_email: actor.email }
    });
    return NextResponse.json({ sent: 0, failed: 0, total: 0, message: "There are no other active project users to notify." });
  }

  const dashboardUrl = projectDashboardUrl(request.url);
  const results: Array<{ email: string; ok: boolean; error?: string; providerId?: string }> = [];
  const publishedKey = String(update.published_at).replace(/[^0-9A-Za-z]/g, "").slice(0, 40);

  // Small controlled batches avoid provider throttling while keeping each
  // recipient private from every other recipient.
  for (let start = 0; start < recipients.length; start += 5) {
    const batch = recipients.slice(start, start + 5);
    const batchResults = await Promise.all(batch.map(async (recipient) => {
      try {
        const providerId = await sendProjectUpdateEmail({
          recipientEmail: recipient.email,
          administratorName: actor.fullName,
          dashboardUrl,
          dataDate: update.data_date ? String(update.data_date) : null,
          idempotencyKey: `taurus-${projectId}-${publishedKey}-${recipient.id}`
        });
        return { email: recipient.email, ok: true, providerId };
      } catch (error) {
        return { email: recipient.email, ok: false, error: error instanceof Error ? error.message : "Email delivery failed." };
      }
    }));
    results.push(...batchResults);
  }

  const sent = results.filter((result) => result.ok).length;
  const failures = results.filter((result) => !result.ok);
  await admin.from("audit_log").insert({
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
      actor_email: actor.email
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
