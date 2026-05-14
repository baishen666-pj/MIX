import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MarketplaceView } from "../components/MarketplaceView";

// Mock useLocale
vi.mock("../i18n", () => ({
  useLocale: () => ({
    t: (key: string) => key,
    locale: "en",
    setLocale: vi.fn(),
  }),
}));

const mockEntries = [
  {
    id: "weather",
    name: "Weather Fetcher",
    description: "Get weather",
    long_description: "Detailed weather info",
    version: "1.0",
    author: "MIX Team",
    category: "utilities",
    tags: ["weather", "api"],
    source_url: "https://example.com/weather",
    license: "MIT",
    handler: "python",
    triggers: ["/weather"],
    installed: false,
  },
  {
    id: "calc",
    name: "Calculator",
    description: "Do math",
    version: "1.0",
    author: "MIX Team",
    category: "developer",
    tags: ["math"],
    source_url: "https://example.com/calc",
    handler: "python",
    triggers: ["/calc"],
    installed: true,
  },
];

function mockFetch(data: unknown, ok = true) {
  return vi.fn(() =>
    Promise.resolve({
      ok,
      status: ok ? 200 : 500,
      json: () => Promise.resolve(data),
    } as Response)
  );
}

describe("MarketplaceView", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders loading state", () => {
    globalThis.fetch = vi.fn(() => new Promise<Response>(() => {}));
    render(<MarketplaceView />);
    expect(screen.getByText("status.loading")).toBeDefined();
  });

  it("renders plugin cards after fetch", async () => {
    globalThis.fetch = mockFetch({
      entries: mockEntries,
      categories: ["utilities", "developer"],
    });
    render(<MarketplaceView />);
    await waitFor(() => {
      expect(screen.getByText("Weather Fetcher")).toBeDefined();
      expect(screen.getByText("Calculator")).toBeDefined();
    });
  });

  it("shows installed badge for installed plugins", async () => {
    globalThis.fetch = mockFetch({
      entries: mockEntries,
      categories: ["utilities"],
    });
    render(<MarketplaceView />);
    await waitFor(() => {
      expect(screen.getByText("marketplace.installed")).toBeDefined();
    });
  });

  it("shows empty state when no entries", async () => {
    globalThis.fetch = mockFetch({ entries: [], categories: [] });
    render(<MarketplaceView />);
    await waitFor(() => {
      expect(screen.getByText("marketplace.noResults")).toBeDefined();
    });
  });

  it("renders category chips", async () => {
    globalThis.fetch = mockFetch({
      entries: mockEntries,
      categories: ["utilities", "developer"],
    });
    render(<MarketplaceView />);
    await waitFor(() => {
      // Cards should be rendered (implies categories loaded too)
      expect(screen.getByText("Weather Fetcher")).toBeDefined();
    });
    // Category text appears in both card badges and category bar
    const utilElements = screen.getAllByText("utilities");
    expect(utilElements.length).toBeGreaterThanOrEqual(1);
  });

  it("navigates to detail view on card click", async () => {
    globalThis.fetch = mockFetch({
      entries: [mockEntries[0]],
      categories: ["utilities"],
    });
    render(<MarketplaceView />);
    await waitFor(() => {
      expect(screen.getByText("Weather Fetcher")).toBeDefined();
    });
    fireEvent.click(screen.getByText("Weather Fetcher"));
    expect(screen.getByText("marketplace.detail.back")).toBeDefined();
  });

  it("calls install API on install button click", async () => {
    globalThis.fetch = mockFetch({
      entries: [mockEntries[0]],
      categories: ["utilities"],
    });
    render(<MarketplaceView />);
    await waitFor(() => {
      expect(screen.getByText("Weather Fetcher")).toBeDefined();
    });
    const installBtn = screen.getByText("marketplace.install");
    const installFetch = mockFetch({ status: "ok", skill: { name: "Weather Fetcher" } });
    globalThis.fetch = installFetch;
    fireEvent.click(installBtn);
    await waitFor(() => {
      expect(installFetch).toHaveBeenCalledWith(
        "/api/plugins/marketplace/install",
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  it("shows update badge for plugins with update available", async () => {
    const entriesWithUpdate = [
      {
        ...mockEntries[1],
        installed: true,
        installed_version: "0.9.0",
        update_available: true,
      },
    ];
    globalThis.fetch = mockFetch({
      entries: entriesWithUpdate,
      categories: ["developer"],
    });
    render(<MarketplaceView />);
    await waitFor(() => {
      expect(screen.getByText("marketplace.updateAvailable")).toBeDefined();
      expect(screen.getByText("marketplace.update")).toBeDefined();
    });
  });

  it("shows only installed badge when no update available", async () => {
    const entriesNoUpdate = [
      {
        ...mockEntries[1],
        installed: true,
        update_available: false,
      },
    ];
    globalThis.fetch = mockFetch({
      entries: entriesNoUpdate,
      categories: ["developer"],
    });
    render(<MarketplaceView />);
    await waitFor(() => {
      expect(screen.getByText("marketplace.installed")).toBeDefined();
    });
    expect(screen.queryByText("marketplace.updateAvailable")).toBeNull();
  });

  it("calls update API on update button click", async () => {
    const entriesWithUpdate = [
      {
        ...mockEntries[1],
        installed: true,
        installed_version: "0.9.0",
        update_available: true,
      },
    ];
    globalThis.fetch = mockFetch({
      entries: entriesWithUpdate,
      categories: ["developer"],
    });
    render(<MarketplaceView />);
    await waitFor(() => {
      expect(screen.getByText("marketplace.update")).toBeDefined();
    });
    const updateBtn = screen.getByText("marketplace.update");
    const updateFetch = mockFetch({ status: "ok", skill: { name: "Calculator", version: "1.0" } });
    globalThis.fetch = updateFetch;
    fireEvent.click(updateBtn);
    await waitFor(() => {
      expect(updateFetch).toHaveBeenCalledWith(
        "/api/plugins/update",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("Calculator"),
        })
      );
    });
  });
});
