import { KpiCard } from "@/components/kpi-card";
import { ProgressExplorer } from "@/components/progress-explorer";
import { overviewCurve } from "@/lib/demo-data";
import { requireSection } from "@/lib/auth";
import { getPublishedProjectUpdate } from "@/lib/published-data";
import { progressPerformance, signalLabel } from "@/lib/progress-metrics";


export default async function ProgressPage() {
  const [, update] = await Promise.all([
    requireSection("progress"),
    getPublishedProjectUpdate({ progressSeries: true })
  ]);
  const curve = update?.progressAnalysis?.chart?.length ? update.progressAnalysis.chart : overviewCurve;
  const performance = progressPerformance(curve);
  return (
    <>
      <div className="page-heading">
        <div><span className="eyebrow">PROGRESS ANALYTICS</span><h1>Monthly and weekly performance</h1><p>Approved baseline and actual cumulative achievement with schedule forecast controls.</p></div>
        <span className="status-pill status-ready">Year · month · week</span>
      </div>
      <section className="kpi-grid five">
        <KpiCard label="Actual" value={performance.actual === null ? "—" : `${(performance.actual * 100).toFixed(2)}%`} detail="Cumulative progress" tone="green" />
        <KpiCard label="Baseline" value={performance.baseline === null ? "—" : `${(performance.baseline * 100).toFixed(2)}%`} detail="At current data date" tone="blue" />
        <KpiCard label="SPI" value={performance.spi === null ? "—" : performance.spi.toFixed(3)} detail={signalLabel(performance.signal)} tone={performance.signal === "ahead" ? "green" : performance.signal === "on-plan" ? "blue" : performance.signal === "slightly-behind" ? "amber" : "red"} />
        <KpiCard label="SV" value={performance.sv === null ? "—" : `${(performance.sv * 100).toFixed(2)} pp`} detail="Actual minus baseline" tone={(performance.sv ?? 0) >= 0 ? "green" : "red"} />
        <KpiCard label="Expected finish" value={performance.expectedFinish ?? "Pending"} detail="Expected completion from baseline duration ÷ SPI" tone="amber" />
      </section>
      <ProgressExplorer series={update?.progressAnalysis?.progressSeries ?? []} fallbackCurve={curve} />
      <section className="dashboard-grid lower-grid progress-notes">
        <article className="panel"><span className="eyebrow">FORECAST METHOD</span><h2>Baseline performance forecast</h2><p>Expected finish uses approved baseline duration divided by the same-date SPI. No current-plan values are used.</p></article>
        <article className="panel"><span className="eyebrow">STATUS THRESHOLDS</span><h2>Controlled schedule signal</h2><div className="thresholds"><span className="green-dot">Ahead &gt; 1.01</span><span className="blue-dot">On baseline 0.99–1.01</span><span className="amber-dot">Slight delay 0.96–0.99</span><span className="red-dot">Delayed &lt; 0.96</span></div></article>
      </section>
    </>
  );
}
