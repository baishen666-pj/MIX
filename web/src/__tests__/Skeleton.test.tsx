import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Skeleton, CardSkeleton, ListSkeleton } from "../components/Skeleton";

describe("Skeleton", () => {
  it("renders with default dimensions", () => {
    const { container } = render(<Skeleton />);
    const el = container.firstChild as HTMLElement;
    expect(el).toBeTruthy();
  });

  it("renders with custom dimensions", () => {
    const { container } = render(<Skeleton width="60%" height={18} />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.width).toBe("60%");
    expect(el.style.height).toBe("18px");
  });
});

describe("CardSkeleton", () => {
  it("renders a card skeleton with mix-card class", () => {
    const { container } = render(<CardSkeleton />);
    expect(container.querySelector(".mix-card")).toBeTruthy();
  });
});

describe("ListSkeleton", () => {
  it("renders default 3 card skeletons", () => {
    const { container } = render(<ListSkeleton />);
    expect(container.querySelectorAll(".mix-card")).toHaveLength(3);
  });

  it("renders specified number of card skeletons", () => {
    const { container } = render(<ListSkeleton count={5} />);
    expect(container.querySelectorAll(".mix-card")).toHaveLength(5);
  });
});
