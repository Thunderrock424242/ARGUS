export default function Loading() {
  return (
    <div className="route-page page-stack" aria-busy="true" aria-label="Loading ARGUS intelligence">
      <div className="skeleton" style={{ width: 210, height: 10 }} />
      <div className="skeleton" style={{ width: "min(480px, 85%)", height: 36 }} />
      <div className="status-strip">
        {Array.from({ length: 8 }, (_, index) => <div key={index} className="skeleton" style={{ height: 76, borderRadius: 0 }} />)}
      </div>
      <div className="dashboard-main-grid">
        <div className="skeleton" style={{ minHeight: 500 }} />
        <div className="skeleton" style={{ minHeight: 500 }} />
      </div>
      <span className="metadata-label">Synchronizing the global operating picture…</span>
    </div>
  );
}
