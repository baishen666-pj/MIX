import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SettingsView } from "../components/SettingsView";

describe("SettingsView", () => {
  it("shows loading state", () => {
    render(<SettingsView health={{}} loading={true} error={null} />);
    expect(screen.getByRole("main").querySelector('[class="mix-card"]')).toBeInTheDocument();
  });

  it("shows error message", () => {
    render(<SettingsView health={{}} loading={false} error="Connection refused" />);
    expect(screen.getByText("Connection refused")).toBeInTheDocument();
  });

  it("shows gateway as running", () => {
    render(<SettingsView health={{}} loading={false} error={null} />);
    expect(screen.getByText("Running")).toBeInTheDocument();
  });

  it("shows connected status when engine is ok", () => {
    render(
      <SettingsView
        health={{ status: "ok", engine: { version: "0.1.0" } }}
        loading={false}
        error={null}
      />
    );
    expect(screen.getByText("Connected")).toBeInTheDocument();
  });

  it("shows degraded status when engine is unreachable", () => {
    render(
      <SettingsView
        health={{ status: "degraded", engine: "unreachable" }}
        loading={false}
        error={null}
      />
    );
    expect(screen.getByText("Degraded")).toBeInTheDocument();
  });

  it("renders active channels as chips", () => {
    render(
      <SettingsView
        health={{ status: "ok", channels: ["webchat", "telegram"] }}
        loading={false}
        error={null}
      />
    );
    expect(screen.getByText("webchat")).toBeInTheDocument();
    expect(screen.getByText("telegram")).toBeInTheDocument();
  });

  it("renders engine details", () => {
    render(
      <SettingsView
        health={{ status: "ok", engine: { version: "0.1.0", engine: "mix-python" } }}
        loading={false}
        error={null}
      />
    );
    expect(screen.getByText("0.1.0")).toBeInTheDocument();
    expect(screen.getByText("mix-python")).toBeInTheDocument();
  });

  it("renders engine section when engine info present", () => {
    const health = { status: "ok", engine: { version: "0.1.0", gateway: "mix-gateway" } };
    render(
      <SettingsView health={health} loading={false} error={null} />
    );
    expect(screen.getByText("mix-gateway")).toBeInTheDocument();
  });
});
