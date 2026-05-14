import { useState, useEffect, useCallback } from "react";
import type { MarketplaceEntry } from "../types";
import { useLocale } from "../i18n";
import { s } from "../styles";

interface MarketplaceResponse {
  entries: MarketplaceEntry[];
  categories: string[];
}

export function MarketplaceView() {
  const { t } = useLocale();
  const [entries, setEntries] = useState<MarketplaceEntry[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [detailEntry, setDetailEntry] = useState<MarketplaceEntry | null>(null);

  const fetchEntries = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set("q", searchQuery);
      if (selectedCategory) params.set("category", selectedCategory);
      const res = await fetch(`/api/plugins/marketplace?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: MarketplaceResponse = await res.json();
      setEntries(data.entries);
      setCategories(data.categories);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fetch failed");
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedCategory]);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(fetchEntries, 200);
    return () => clearTimeout(timer);
  }, [fetchEntries]);

  const handleInstall = useCallback(async (entry: MarketplaceEntry) => {
    setInstallingId(entry.id);
    try {
      const res = await fetch("/api/plugins/marketplace/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: entry.id }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        setError(json.error ?? `HTTP ${res.status}`);
      } else {
        setEntries((prev) =>
          prev.map((e) => (e.id === entry.id ? { ...e, installed: true } : e))
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Install failed");
    } finally {
      setInstallingId(null);
    }
  }, []);

  const handleUpdate = useCallback(async (entry: MarketplaceEntry) => {
    setUpdatingId(entry.id);
    try {
      const res = await fetch("/api/plugins/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: entry.name }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        setError(json.error ?? `HTTP ${res.status}`);
      } else {
        setEntries((prev) =>
          prev.map((e) =>
            e.id === entry.id
              ? { ...e, update_available: false, installed: true, installed_version: e.version }
              : e
          )
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setUpdatingId(null);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetch("/api/plugins/marketplace/refresh", { method: "POST" });
      await fetchEntries();
    } finally {
      setRefreshing(false);
    }
  }, [fetchEntries]);

  if (detailEntry) {
    return (
      <div style={s.detailSection}>
        <button
          onClick={() => setDetailEntry(null)}
          style={{ ...s.button, marginBottom: 12 }}
        >
          {t("marketplace.detail.back")}
        </button>
        <h3 style={{ margin: "0 0 8px" }}>
          {detailEntry.name}{" "}
          <span style={s.badge}>v{detailEntry.version}</span>
        </h3>
        <div style={{ ...s.cardDesc, marginBottom: 8, fontSize: 13 }}>
          {t("marketplace.by")} {detailEntry.author}
        </div>
        <div style={{ ...s.cardDesc, marginBottom: 12, lineHeight: 1.6 }}>
          {detailEntry.long_description || detailEntry.description}
        </div>
        <div style={{ marginBottom: 8 }}>
          <strong>{t("marketplace.detail.triggers")}:</strong>{" "}
          {detailEntry.triggers.map((tr) => (
            <code key={tr} style={{ ...s.tagChip, fontFamily: "var(--font-mono)" }}>{tr}</code>
          ))}
        </div>
        {detailEntry.tags.length > 0 && (
          <div style={{ ...s.pluginCardMeta, marginBottom: 8 }}>
            {detailEntry.tags.map((tag) => (
              <span key={tag} style={s.tagChip}>{tag}</span>
            ))}
          </div>
        )}
        <div style={{ display: "flex", gap: 12, fontSize: 12, color: "var(--color-text-muted)", marginBottom: 12 }}>
          {detailEntry.license && <span>{t("marketplace.license")}: {detailEntry.license}</span>}
          {detailEntry.dependencies && detailEntry.dependencies.length > 0 && (
            <span>{t("marketplace.dependencies")}: {detailEntry.dependencies.join(", ")}</span>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {detailEntry.update_available ? (
            <>
              <span style={s.installedBadge}>{t("marketplace.installed")}</span>
              <span style={s.updateBadge}>{t("marketplace.updateAvailable")}</span>
              <button
                onClick={() => handleUpdate(detailEntry)}
                disabled={updatingId !== null}
                style={updatingId === detailEntry.id ? { ...s.updateBtn, opacity: 0.6 } : s.updateBtn}
              >
                {updatingId === detailEntry.id ? t("marketplace.updating") : t("marketplace.update")}
              </button>
            </>
          ) : detailEntry.installed ? (
            <span style={s.installedBadge}>{t("marketplace.installed")}</span>
          ) : (
            <button
              onClick={() => handleInstall(detailEntry)}
              disabled={installingId !== null}
              style={installingId === detailEntry.id ? { ...s.installBtn, opacity: 0.6 } : s.installBtn}
            >
              {installingId === detailEntry.id ? t("marketplace.installing") : t("marketplace.install")}
            </button>
          )}
        </div>
        {error && <div style={{ ...s.error, marginTop: 8 }}>{error}</div>}
      </div>
    );
  }

  return (
    <div>
      <div style={s.marketplaceSearch}>
        <input
          style={{ ...s.input, flex: 1, fontSize: 13 }}
          placeholder={t("marketplace.search")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          style={refreshing ? { ...s.refreshBtn, opacity: 0.6 } : s.refreshBtn}
        >
          {refreshing ? t("marketplace.refreshing") : t("marketplace.refresh")}
        </button>
      </div>

      <div style={s.categoryBar}>
        <button
          onClick={() => setSelectedCategory("")}
          style={selectedCategory === "" ? s.categoryChipActive : s.categoryChip}
        >
          {t("marketplace.all")}
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(selectedCategory === cat ? "" : cat)}
            style={selectedCategory === cat ? s.categoryChipActive : s.categoryChip}
          >
            {cat}
          </button>
        ))}
      </div>

      {loading && <div style={s.loading}>{t("status.loading")}</div>}
      {error && <div style={s.error}>{error}</div>}
      {!loading && entries.length === 0 && (
        <div style={{ ...s.empty, padding: 32 }}>
          <div>{t("marketplace.noResults")}</div>
          <div style={{ fontSize: 12, marginTop: 4, color: "var(--color-text-muted)" }}>
            {t("marketplace.tryDifferent")}
          </div>
        </div>
      )}

      <div style={s.pluginGrid}>
        {entries.map((entry) => (
          <div
            key={entry.id}
            style={s.pluginCard}
            className="card-hover"
            onClick={() => setDetailEntry(entry)}
          >
            <div style={s.pluginCardTop}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>
                  {entry.name}
                </div>
                <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                  {t("marketplace.by")} {entry.author} · v{entry.version}
                </div>
              </div>
              <span style={{ ...s.badge, fontSize: 10, textTransform: "capitalize" }}>
                {entry.category}
              </span>
            </div>
            <div style={{ ...s.cardDesc, fontSize: 12, lineHeight: 1.4 }}>
              {entry.description}
            </div>
            {entry.tags.length > 0 && (
              <div style={s.pluginCardMeta}>
                {entry.tags.slice(0, 3).map((tag) => (
                  <span key={tag} style={s.tagChip}>{tag}</span>
                ))}
              </div>
            )}
            <div style={{ marginTop: "auto", paddingTop: 4 }}>
              {entry.update_available ? (
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={s.installedBadge}>{t("marketplace.installed")}</span>
                  <span style={s.updateBadge}>{t("marketplace.updateAvailable")}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleUpdate(entry); }}
                    disabled={updatingId !== null}
                    style={updatingId === entry.id ? { ...s.updateBtn, opacity: 0.6 } : s.updateBtn}
                  >
                    {updatingId === entry.id ? t("marketplace.updating") : t("marketplace.update")}
                  </button>
                </div>
              ) : entry.installed ? (
                <span style={s.installedBadge}>{t("marketplace.installed")}</span>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); handleInstall(entry); }}
                  disabled={installingId !== null}
                  style={installingId === entry.id ? { ...s.installBtn, opacity: 0.6 } : s.installBtn}
                >
                  {installingId === entry.id ? t("marketplace.installing") : t("marketplace.install")}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
