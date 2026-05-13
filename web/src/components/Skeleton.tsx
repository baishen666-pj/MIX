export function Skeleton({ width, height, radius }: { width?: string | number; height?: string | number; radius?: string | number }) {
  return (
    <div
      style={{
        width: width ?? "100%",
        height: height ?? 20,
        borderRadius: radius ?? 6,
        background: "var(--color-surface-hover)",
        animation: "pulse 1.4s ease-in-out infinite",
      }}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="mix-card">
      <Skeleton width="60%" height={18} />
      <div style={{ marginTop: 8 }}><Skeleton width="100%" height={14} /></div>
      <div style={{ marginTop: 6 }}><Skeleton width="40%" height={12} /></div>
    </div>
  );
}

export function ListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {Array.from({ length: count }, (_, i) => <CardSkeleton key={i} />)}
    </div>
  );
}
