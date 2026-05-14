import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { LoadingSpinner } from "../components/LoadingSpinner";

describe("LoadingSpinner", () => {
  it("renders with default size (md)", () => {
    const { container } = render(<LoadingSpinner />);
    const spinner = container.firstChild as HTMLElement;
    expect(spinner).toBeTruthy();
    expect(spinner.style.width).toBe("16px");
    expect(spinner.style.height).toBe("16px");
  });

  it("renders with small size", () => {
    const { container } = render(<LoadingSpinner size="sm" />);
    const spinner = container.firstChild as HTMLElement;
    expect(spinner.style.width).toBe("12px");
  });

  it("renders with large size", () => {
    const { container } = render(<LoadingSpinner size="lg" />);
    const spinner = container.firstChild as HTMLElement;
    expect(spinner.style.width).toBe("24px");
  });
});
