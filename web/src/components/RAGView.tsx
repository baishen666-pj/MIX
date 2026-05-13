import { useState, useEffect, useCallback, useRef } from "react";
import { s } from "../styles";

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

  const deleteCollection = async (id: string) => {
    await fetch(`/api/rag/collections/${id}`, { method: "DELETE" });
    if (selectedColl === id) {
      setSelectedColl(null);
      setDocuments([]);
    }
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

  const deleteDocument = async (docId: string) => {
    await fetch(`/api/rag/documents/${docId}`, { method: "DELETE" });
    if (selectedColl) await fetchDocuments(selectedColl);
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

  if (loading) return <div style={s.loading}>Loading...</div>;

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {(["collections", "query"] as RagTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setRagTab(t)}
            style={{
              ...s.button,
              background: ragTab === t ? "#4fc3f7" : "transparent",
              color: ragTab === t ? "#000" : "#aaa",
              border: `1px solid ${ragTab === t ? "#4fc3f7" : "#444"}`,
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
                style={{ ...s.input, width: "100%", marginBottom: 4 }}
              />
              <input
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Description (optional)"
                style={{ ...s.input, width: "100%", marginBottom: 4 }}
              />
              <button onClick={createCollection} style={{ ...s.button, width: "100%" }}>
                Create Collection
              </button>
            </div>

            {collections.map((coll) => (
              <div
                key={coll.id}
                onClick={() => selectCollection(coll.id)}
                style={{
                  ...s.card,
                  cursor: "pointer",
                  marginBottom: 8,
                  border: selectedColl === coll.id ? "2px solid #4fc3f7" : "1px solid #333",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong style={{ fontSize: 14 }}>{coll.name}</strong>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteCollection(coll.id); }}
                    style={{ background: "none", border: "none", color: "#f44336", cursor: "pointer", fontSize: 12 }}
                  >
                    x
                  </button>
                </div>
                <div style={{ color: "#888", fontSize: 12 }}>
                  {coll.document_count} docs | {coll.embedding_model}
                </div>
                {coll.description && <div style={{ color: "#666", fontSize: 11, marginTop: 2 }}>{coll.description}</div>}
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
                  <button onClick={() => fileInputRef.current?.click()} style={s.button}>
                    Upload Document
                  </button>
                </div>

                {documents.length === 0 && (
                  <div style={{ color: "#888", padding: 20, textAlign: "center" }}>
                    No documents yet. Upload a file to get started.
                  </div>
                )}

                {documents.map((doc) => (
                  <div key={doc.id} style={{ ...s.card, marginBottom: 8, padding: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <strong>{doc.filename}</strong>
                        <span style={{ color: "#888", marginLeft: 8, fontSize: 12 }}>
                          {doc.chunk_count} chunks | {formatBytes(doc.size_bytes)}
                        </span>
                      </div>
                      <button
                        onClick={() => deleteDocument(doc.id)}
                        style={{ ...s.button, background: "#f44336", padding: "2px 8px", fontSize: 12 }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <div style={{ color: "#888", padding: 40, textAlign: "center" }}>
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
              style={{ ...s.input, flex: 1 }}
              onKeyDown={(e) => { if (e.key === "Enter") runQuery(); }}
            />
            <button
              onClick={runQuery}
              disabled={queryRunning || !query.trim()}
              style={{
                ...s.button,
                background: queryRunning ? "#666" : "#4caf50",
                color: queryRunning ? "#999" : "#fff",
              }}
            >
              {queryRunning ? "Searching..." : "Query"}
            </button>
          </div>

          {queryResult && (
            <div>
              <div style={{ ...s.card, marginBottom: 12 }}>
                <div style={{ color: "#888", fontSize: 12, marginBottom: 8 }}>
                  Retrieved {queryResult.retrieved_chunks} chunks | {queryResult.latency_ms.toFixed(0)}ms
                </div>
                <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{queryResult.answer}</div>
              </div>

              {queryResult.citations.length > 0 && (
                <div>
                  <h4 style={{ margin: "16px 0 8px", color: "#aaa" }}>Sources</h4>
                  {queryResult.citations.map((cit, i) => (
                    <div key={`${cit.document_id}-${cit.chunk_index}`} style={{ ...s.card, marginBottom: 8, padding: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <strong style={{ color: "#4fc3f7" }}>[{i + 1}] {cit.document_name}</strong>
                        <span style={{ color: "#888", fontSize: 12 }}>
                          relevance: {cit.relevance_score.toFixed(2)}
                        </span>
                      </div>
                      <div style={{ color: "#aaa", fontSize: 12, marginTop: 4 }}>
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
    </div>
  );
}
