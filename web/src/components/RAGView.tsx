import { useState, useEffect, useCallback, useRef } from "react";
import { ConfirmDialog } from "./ConfirmDialog";

interface Collection {
  id: string;
  name: string;
  description: string;
  document_count: number;
  embedding_model: string;
}

interface Document {
  id: string;
  filename: string;
  chunk_count: number;
  size_bytes: number;
  created_at: string;
}

interface Citation {
  document_id: string;
  document_name: string;
  collection_id: string;
  chunk_index: number;
  content: string;
  relevance_score: number;
}

type RagTab = "collections" | "query";

export function RAGView() {
  const [ragTab, setRagTab] = useState<RagTab>("collections");
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedColl, setSelectedColl] = useState<string | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);

  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const [query, setQuery] = useState("");
  const [queryResult, setQueryResult] = useState<{
    answer: string;
    citations: Citation[];
    retrieved_chunks: number;
    latency_ms: number;
  } | null>(null);
  const [queryRunning, setQueryRunning] = useState(false);

  const [pendingDeleteColl, setPendingDeleteColl] = useState<string | null>(null);
  const [pendingDeleteDoc, setPendingDeleteDoc] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchCollections = useCallback(async () => {
    try {
      const res = await fetch("/api/rag/collections");
      const data = await res.json();
      setCollections(data.collections || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchCollections().finally(() => setLoading(false));
  }, [fetchCollections]);

  const fetchDocuments = useCallback(async (collId: string) => {
    try {
      const res = await fetch(`/api/rag/collections/${collId}/documents`);
      const data = await res.json();
      setDocuments(data.documents || []);
    } catch {
      setDocuments([]);
    }
  }, []);

  const selectCollection = async (id: string) => {
    setSelectedColl(id);
    await fetchDocuments(id);
  };

  const createCollection = async () => {
    if (!newName.trim()) return;
    await fetch("/api/rag/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), description: newDesc }),
    });
    setNewName("");
    setNewDesc("");
    await fetchCollections();
  };

  const deleteCollection = (id: string) => {
    setPendingDeleteColl(id);
  };

  const confirmDeleteCollection = async () => {
    if (!pendingDeleteColl) return;
    try {
      await fetch(`/api/rag/collections/${pendingDeleteColl}`, { method: "DELETE" });
      if (selectedColl === pendingDeleteColl) {
        setSelectedColl(null);
        setDocuments([]);
      }
    } catch {
      // Deletion failed — UI will remain unchanged
    }
    setPendingDeleteColl(null);
    await fetchCollections();
  };

  const uploadDocument = async (collId: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    await fetch(`/api/rag/collections/${collId}/documents`, {
      method: "POST",
      body: formData,
    });
    await fetchDocuments(collId);
    await fetchCollections();
  };

  const deleteDocument = (docId: string) => {
    setPendingDeleteDoc(docId);
  };

  const confirmDeleteDocument = async () => {
    if (!pendingDeleteDoc || !selectedColl) return;
    try {
      await fetch(`/api/rag/documents/${pendingDeleteDoc}`, { method: "DELETE" });
    } catch {
      // Deletion failed — UI will remain unchanged
    }
    setPendingDeleteDoc(null);
    await fetchDocuments(selectedColl);
  };

  const runQuery = async () => {
    if (!query.trim()) return;
    setQueryRunning(true);
    setQueryResult(null);
    try {
      const res = await fetch("/api/rag/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, top_k: 10, rerank: true, include_citations: true }),
      });
      const data = await res.json();
      setQueryResult(data);
    } catch {
      setQueryResult({ answer: "Query failed", citations: [], retrieved_chunks: 0, latency_ms: 0 });
    } finally {
      setQueryRunning(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) return <div className="mix-panel" style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-base)", textAlign: "center" }}>Loading...</div>;

  return (
    <div className="mix-panel">
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {(["collections", "query"] as RagTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setRagTab(t)}
            className="mix-btn"
            style={{
              background: ragTab === t ? "var(--color-status-info)" : "transparent",
              color: ragTab === t ? "var(--color-text)" : "var(--color-text-muted)",
              border: `1px solid ${ragTab === t ? "var(--color-status-info)" : "var(--color-border)"}`,
            }}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {ragTab === "collections" && (
        <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 16 }}>
          {/* Left: Collection list */}
          <div>
            <div style={{ marginBottom: 12 }}>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Collection name"
                className="mix-input"
                style={{ width: "100%", marginBottom: 4 }}
              />
              <input
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Description (optional)"
                className="mix-input"
                style={{ width: "100%", marginBottom: 4 }}
              />
              <button onClick={createCollection} className="mix-btn" style={{ width: "100%" }}>
                Create Collection
              </button>
            </div>

            {collections.map((coll) => (
              <div
                key={coll.id}
                onClick={() => selectCollection(coll.id)}
                className="mix-card"
                style={{
                  cursor: "pointer",
                  marginBottom: 8,
                  border: selectedColl === coll.id ? "2px solid var(--color-status-info)" : "1px solid var(--color-border)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong style={{ fontSize: 14 }}>{coll.name}</strong>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteCollection(coll.id); }}
                    style={{ background: "none", border: "none", color: "var(--color-status-error)", cursor: "pointer", fontSize: 12 }}
                  >
                    x
                  </button>
                </div>
                <div style={{ color: "var(--color-text-muted)", fontSize: 12 }}>
                  {coll.document_count} docs | {coll.embedding_model}
                </div>
                {coll.description && <div style={{ color: "var(--color-text-muted)", fontSize: 11, marginTop: 2 }}>{coll.description}</div>}
              </div>
            ))}
          </div>

          {/* Right: Documents */}
          <div>
            {selectedColl ? (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  <h3 style={{ margin: 0 }}>
                    {collections.find((c) => c.id === selectedColl)?.name}
                  </h3>
                  <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadDocument(selectedColl, file);
                    }}
                  />
                  <button onClick={() => fileInputRef.current?.click()} className="mix-btn">
                    Upload Document
                  </button>
                </div>

                {documents.length === 0 && (
                  <div style={{ color: "var(--color-text-muted)", padding: 20, textAlign: "center" }}>
                    No documents yet. Upload a file to get started.
                  </div>
                )}

                {documents.map((doc) => (
                  <div key={doc.id} className="mix-card" style={{ marginBottom: 8, padding: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <strong>{doc.filename}</strong>
                        <span style={{ color: "var(--color-text-muted)", marginLeft: 8, fontSize: 12 }}>
                          {doc.chunk_count} chunks | {formatBytes(doc.size_bytes)}
                        </span>
                      </div>
                      <button
                        onClick={() => deleteDocument(doc.id)}
                        className="mix-btn"
                        style={{ background: "var(--color-status-error)", padding: "2px 8px", fontSize: 12 }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <div style={{ color: "var(--color-text-muted)", padding: 40, textAlign: "center" }}>
                Select a collection to view and upload documents.
              </div>
            )}
          </div>
        </div>
      )}

      {ragTab === "query" && (
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask a question about your documents..."
              className="mix-input"
              style={{ flex: 1 }}
              onKeyDown={(e) => { if (e.key === "Enter") runQuery(); }}
            />
            <button
              onClick={runQuery}
              disabled={queryRunning || !query.trim()}
              className="mix-btn"
              style={{
                background: queryRunning ? "var(--color-text-muted)" : "var(--color-status-success)",
                color: queryRunning ? "var(--color-text-muted)" : "#fff",
              }}
            >
              {queryRunning ? "Searching..." : "Query"}
            </button>
          </div>

          {queryResult && (
            <div>
              <div className="mix-card" style={{ marginBottom: 12 }}>
                <div style={{ color: "var(--color-text-muted)", fontSize: 12, marginBottom: 8 }}>
                  Retrieved {queryResult.retrieved_chunks} chunks | {queryResult.latency_ms.toFixed(0)}ms
                </div>
                <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{queryResult.answer}</div>
              </div>

              {queryResult.citations.length > 0 && (
                <div>
                  <h4 style={{ margin: "16px 0 8px", color: "var(--color-text-muted)" }}>Sources</h4>
                  {queryResult.citations.map((cit, i) => (
                    <div key={`${cit.document_id}-${cit.chunk_index}`} className="mix-card" style={{ marginBottom: 8, padding: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <strong style={{ color: "var(--color-status-info)" }}>[{i + 1}] {cit.document_name}</strong>
                        <span style={{ color: "var(--color-text-muted)", fontSize: 12 }}>
                          relevance: {cit.relevance_score.toFixed(2)}
                        </span>
                      </div>
                      <div style={{ color: "var(--color-text-muted)", fontSize: 12, marginTop: 4 }}>
                        {cit.content.slice(0, 300)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {pendingDeleteColl && (
        <ConfirmDialog
          message={`Delete this collection and all its documents?`}
          onConfirm={confirmDeleteCollection}
          onCancel={() => setPendingDeleteColl(null)}
        />
      )}
      {pendingDeleteDoc && (
        <ConfirmDialog
          message={`Delete this document?`}
          onConfirm={confirmDeleteDocument}
          onCancel={() => setPendingDeleteDoc(null)}
        />
      )}
    </div>
  );
}
