import { createAuthorizedDataClient } from "@/lib/supabase/data";

export type ActivityEntry = {
  id: number;
  eventType: string;
  entityType: string;
  entityId: string | null;
  details: Record<string, unknown>;
  createdAt: string;
  actorName: string;
  actorEmail: string;
};

export async function listActivityEntries(limit = 200): Promise<ActivityEntry[]> {
  const supabase = await createAuthorizedDataClient();
  const { data: logs, error } = await supabase
    .from("audit_log")
    .select("id, actor_id, event_type, entity_type, entity_id, details, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);

  const actorIds = [...new Set((logs ?? []).map((entry) => entry.actor_id).filter(Boolean))] as string[];
  const actors = new Map<string, { full_name: string; email: string }>();
  if (actorIds.length) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", actorIds);
    for (const profile of profiles ?? []) actors.set(profile.id, profile);
  }

  return (logs ?? []).map((entry) => {
    const actor = entry.actor_id ? actors.get(entry.actor_id) : undefined;
    return {
      id: entry.id,
      eventType: entry.event_type,
      entityType: entry.entity_type,
      entityId: entry.entity_id,
      details: entry.details && typeof entry.details === "object" && !Array.isArray(entry.details)
        ? entry.details as Record<string, unknown>
        : {},
      createdAt: entry.created_at,
      actorName: actor?.full_name || String((entry.details as Record<string, unknown> | null)?.actor_name ?? "System / removed user"),
      actorEmail: actor?.email || String((entry.details as Record<string, unknown> | null)?.actor_email ?? "—")
    };
  });
}
