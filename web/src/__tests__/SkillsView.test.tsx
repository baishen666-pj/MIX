import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SkillsView } from "../components/SkillsView";
import type { Skill } from "../types";

describe("SkillsView", () => {
  it("shows loading state", () => {
    render(<SkillsView skills={[]} loading={true} error={null} />);
    expect(screen.getByText("Loading skills...")).toBeInTheDocument();
  });

  it("shows error message", () => {
    render(<SkillsView skills={[]} loading={false} error="Failed to load" />);
    expect(screen.getByText("Failed to load")).toBeInTheDocument();
  });

  it("shows empty state when no skills", () => {
    render(<SkillsView skills={[]} loading={false} error={null} />);
    expect(screen.getByText("No skills loaded")).toBeInTheDocument();
  });

  it("renders skill cards", () => {
    const skills: Skill[] = [
      {
        name: "weather",
        version: "1.0.0",
        description: "Get weather info",
        trigger: ["/weather"],
        handler: "weather.py",
      },
      {
        name: "translate",
        version: "2.1.0",
        description: "Translate text",
        trigger: ["/tr", "/translate"],
        handler: "translate.py",
      },
    ];
    render(<SkillsView skills={skills} loading={false} error={null} />);

    expect(screen.getByText("weather")).toBeInTheDocument();
    expect(screen.getByText("1.0.0")).toBeInTheDocument();
    expect(screen.getByText("Get weather info")).toBeInTheDocument();
    expect(screen.getByText("translate")).toBeInTheDocument();
    expect(screen.getByText("2.1.0")).toBeInTheDocument();
    expect(screen.getByText("Translate text")).toBeInTheDocument();
  });

  it("renders trigger codes", () => {
    const skills: Skill[] = [
      {
        name: "test",
        version: "1.0.0",
        description: "desc",
        trigger: ["/foo", "/bar"],
        handler: "test.py",
      },
    ];
    render(<SkillsView skills={skills} loading={false} error={null} />);
    expect(screen.getByText("/foo")).toBeInTheDocument();
    expect(screen.getByText("/bar")).toBeInTheDocument();
  });
});
