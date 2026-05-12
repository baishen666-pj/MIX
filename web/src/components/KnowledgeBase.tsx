import { useState, useRef, useCallback } from "react";
import { s } from "../styles";

interface KnowledgeBaseProps {
  onRefresh: () => void;
}

export function KnowledgeBase({ onRefresh }: KnowledgeBaseProps) {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/memory/upload", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (json.error) {
        setError(json.error);
      } else {
        setResult(`Uploaded "${json.filename}" — ${json.chunks_created} chunks created`);
        onRefresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }, [onRefresh]);

  return (
    <div style={{ ...s.card, padding: 16 }}>
      <h3 style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 600, color: "var(--color-text)" }}>
        Knowledge Base
      </h3>
      <p style={{ ...s.cardDesc, margin: "0 0 12px" }}>
        Upload documents (PDF, DOCX, TXT, MD) to add them to the knowledge base.
        Documents are automatically chunked and indexed for semantic search.
      </p>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.docx,.doc,.txt,.md,.csv,.json,.html,.xml"
          style={{ fontSize: 13, color: "var(--color-text-secondary)" }}
        />
        <button
          style={uploading ? s.sendBtnDisabled : s.sendBtn}
          onClick={handleUpload}
          disabled={uploading}
        >
          {uploading ? "Uploading..." : "Upload"}
        </button>
      </div>
      {result && (
        <div style={{ color: "var(--color-success)", fontSize: 13, marginTop: 8 }}>
          {result}
        </div>
      )}
      {error && (
        <div style={s.error}>{error}</div>
      )}
    </div>
  );
}
