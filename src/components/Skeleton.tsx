export function SkeletonLine({ width = '100%', height = '12px' }: { width?: string; height?: string }) {
  return <div className="animate-shimmer rounded-md" style={{ width, height }} />;
}

export function SkeletonCard() {
  return (
    <div className="p-4 rounded-xl bg-surface-2 space-y-3">
      <SkeletonLine width="60%" height="14px" />
      <SkeletonLine width="90%" />
      <SkeletonLine width="45%" />
    </div>
  );
}

export function SkeletonSessionList({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2 p-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-2 rounded-lg">
          <div className="w-8 h-8 rounded-lg animate-shimmer shrink-0" />
          <div className="flex-1 space-y-1.5">
            <SkeletonLine width="70%" height="11px" />
            <SkeletonLine width="40%" height="9px" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonPage() {
  return (
    <div className="p-6 space-y-4 animate-fade-in">
      <SkeletonLine width="200px" height="20px" />
      <div className="grid grid-cols-3 gap-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <SkeletonCard />
    </div>
  );
}
