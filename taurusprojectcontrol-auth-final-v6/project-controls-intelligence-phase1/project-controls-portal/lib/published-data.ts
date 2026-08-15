import { createClient } from "@/lib/supabase/server";
import { getDefaultProjectId } from "@/lib/project";
import { isDemoMode, isSupabaseConfigured } from "@/lib/config";
import type { PublishedProjectUpdate } from "@/lib/types";

export async function getPublishedProjectUpdate(): Promise<PublishedProjectUpdate | null> {
  if (isDemoMode || !isSupabaseConfigured || !process.env.DEFAULT_PROJECT_ID) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("published_project_updates").select("*").eq("project_id", getDefaultProjectId()).maybeSingle();
  if (!data) return null;
  return { id: data.id, projectId: data.project_id, progressFileName: data.progress_file_name, scheduleFileName: data.schedule_file_name, dataDate: data.data_date, progressAnalysis: data.progress_analysis, scheduleAnalysis: data.schedule_analysis, publishedAt: data.published_at, publishedBy: data.published_by };
}

export function metric(summary: Record<string, string | number | null> | undefined, key: string, fallback: number) {
  const value = Number(summary?.[key]);
  return Number.isFinite(value) ? value : fallback;
}
