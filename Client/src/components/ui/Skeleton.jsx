import './Skeleton.css';

export function SkeletonCard({ className = '' }) {
  return <div className={`fluxy-skeleton fluxy-skeleton-card glass-card ${className}`.trim()} />;
}

export function SkeletonRow({ wide }) {
  return (
    <div
      className={`fluxy-skeleton fluxy-skeleton-row ${wide ? 'fluxy-skeleton-row--wide' : ''}`.trim()}
    />
  );
}

export function SkeletonGrid({ count = 6 }) {
  return (
    <div className="loading-grid">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
