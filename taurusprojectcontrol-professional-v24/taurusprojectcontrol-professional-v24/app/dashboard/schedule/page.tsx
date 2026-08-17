import { ScheduleExplorer } from "@/components/schedule-explorer";
import { requireSection } from "@/lib/auth";
import { getPublishedProjectUpdate, metric } from "@/lib/published-data";

export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  await requireSection("schedule");
  const update = await getPublishedProjectUpdate({ scheduleActivities: true });
  const snapshot = update?.scheduleAnalysis;
  const summary = snapshot?.summary;
  const activities = snapshot?.scheduleActivities ?? [];
  return (
    <>
      <div className="page-heading schedule-reference-heading"><div><span className="eyebrow">PROJECT SCHEDULE</span><h1>Project Plan &amp; WBS Overview</h1><p>Integrated view of WBS structure, activities, milestones, and performance from the latest Excel schedule.</p></div></div>
      <ScheduleExplorer
        activities={activities}
        dataDate={String(summary?.dataDate ?? update?.dataDate ?? "") || null}
        forecastFinish={String(summary?.forecastFinish ?? "—")}
        mappingWarnings={metric(summary, "disciplineErrors", 0)}
        scheduleRows={metric(summary, "rows", activities.length)}
      />
    </>
  );
}
