interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
}

export function EmptyState({ icon, title, description }: EmptyStateProps) {
  return (
    <div style={{ padding: 40, textAlign: "center", color: "var(--color-text-muted)" }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 14 }}>{title}</div>
      <div style={{ fontSize: 12, marginTop: 4 }}>{description}</div>
    </div>
  );
}
