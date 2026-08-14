import { BarList } from "@/components/bar-list";
import { KpiCard } from "@/components/kpi-card";
import { ScurveChart } from "@/components/scurve-chart";
import {
  actionDistribution,
  dashboardMetrics,
  disciplineDistribution,
  overviewCurve
} from "@/lib/demo-data";

export default function DashboardPage() {
  const metrics = dashboardMetrics;
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">EXECUTIVE CONTROL ROOM</span>
          <h1>Project performance overview</h1>
          <p>Latest controlled progress, document status, and schedule position.</p>
        </div>
        <button className="secondary-button" type="button">Export briefing</button>
      </div>

      <section className="kpi-grid six">
        <KpiCard label="Actual progress" value={`${metrics.actual.toFixed(2)}%`} detail="Earned to data date" tone="green" />
        <KpiCard label="Planned progress" value={`${metrics.planned.toFixed(2)}%`} detail="Current approved plan" tone="blue" />
        <KpiCard label="SPI" value={metrics.spi.toFixed(3)} detail="Slightly behind" tone="amber" />
        <KpiCard label="Schedule variance" value={`${metrics.sv.toFixed(2)} pp`} detail="Actual minus planned" tone="red" />
        <KpiCard label="Controlled documents" value={metrics.totalDocuments.toLocaleString()} detail={`${metrics.approved} final approved`} />
        <KpiCard label="Critical activities" value={String(metrics.criticalActivities)} detail={`of ${metrics.scheduleActivities.toLocaleString()} activities`} tone="red" />
      </section>

      <section className="dashboard-grid main-dashboard-grid">
        <article className="panel wide-panel">
          <div className="panel-heading">
            <div><span className="eyebrow">PERFORMANCE CURVE</span><h2>Overall monthly S-curve</h2></div>
            <div className="segmented"><button className="selected">Overall</button><button>Engineering</button><button>Procurement</button><button>Construction</button></div>
          </div>
          <ScurveChart points={overviewCurve} />
        </article>
        <article className="panel insight-panel">
          <div className="panel-heading"><div><span className="eyebrow">CONTROL STATUS</span><h2>Management signal</h2></div></div>
          <div className="signal-card amber-signal">
            <span>SCHEDULE STATUS</span>
            <strong>Slightly behind plan</strong>
            <p>SPI is 0.964 with a variance of −1.31 percentage points.</p>
          </div>
          <div className="metric-line"><span>Baseline position</span><strong>{metrics.baseline.toFixed(2)}%</strong></div>
          <div className="metric-line"><span>Current plan</span><strong>{metrics.planned.toFixed(2)}%</strong></div>
          <div className="metric-line"><span>Actual achieved</span><strong>{metrics.actual.toFixed(2)}%</strong></div>
          <div className="data-quality"><i>✓</i><div><strong>Workbook structure recognized</strong><span>7 progress sheets and 1 schedule sheet</span></div></div>
        </article>
      </section>

      <section className="dashboard-grid lower-grid">
        <article className="panel">
          <div className="panel-heading"><div><span className="eyebrow">DOCUMENT REGISTER</span><h2>Distribution by discipline</h2></div></div>
          <BarList data={disciplineDistribution} />
        </article>
        <article className="panel">
          <div className="panel-heading"><div><span className="eyebrow">RESPONSIBILITY</span><h2>Current document action</h2></div></div>
          <BarList data={actionDistribution} />
        </article>
      </section>
    </>
  );
}
