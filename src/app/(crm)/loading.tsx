export default function Loading() {
  return (
    <main className="loading-page" aria-label="Loading workspace">
      <div className="skeleton" style={{ width: 260, height: 36 }} />
      <div className="stats-grid">
        {[1, 2, 3, 4].map((n) => (
          <div className="skeleton" style={{ height: 145 }} key={n} />
        ))}
      </div>
      <div className="skeleton" style={{ height: 380 }} />
    </main>
  );
}
