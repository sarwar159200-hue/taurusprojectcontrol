export default function DashboardLoading() {
  return (
    <div className="dashboard-loading" aria-label="Loading project controls data" role="status">
      <div className="dashboard-loading-title" />
      <div className="dashboard-loading-kpis">
        {Array.from({ length: 7 }, (_, index) => <div key={index} />)}
      </div>
      <div className="dashboard-loading-panel" />
    </div>
  );
}
