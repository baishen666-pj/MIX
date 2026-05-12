import { s } from "../styles";

interface ErrorBannerProps {
  message: string;
  onDismiss: () => void;
}

export function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
  return (
    <div style={s.errorBanner}>
      <span>{message}</span>
      <button onClick={onDismiss} style={s.errorDismiss}>&times;</button>
    </div>
  );
}
