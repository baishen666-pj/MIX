import { s } from "../styles";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
}

const sizes = { sm: 12, md: 16, lg: 24 };

export function LoadingSpinner({ size = "md" }: LoadingSpinnerProps) {
  const px = sizes[size];
  return (
    <span style={{ ...s.spinner, width: px, height: px, borderWidth: Math.max(2, px / 8) }} />
  );
}
