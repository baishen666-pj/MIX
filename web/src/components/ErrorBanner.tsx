interface ErrorBannerProps {
  message: string;
  onDismiss: () => void;
}

export function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
  return (
    <div style={s.banner}>
      <span>{message}</span>
      <button onClick={onDismiss} style={s.dismiss}>&times;</button>
    </div>
  );
}

const s = {
  banner: { background: "#451a1a", border: "1px solid #7f1d1d", color: "#fca5a5", padding: "10px 16px", borderRadius: 8, marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 } as React.CSSProperties,
  dismiss: { background: "none", border: "none", color: "#fca5a5", cursor: "pointer", fontSize: 16, padding: "0 4px" } as React.CSSProperties,
};
