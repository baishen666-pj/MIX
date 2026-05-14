from __future__ import annotations

import json
import logging
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import aiosqlite

from engine.memory.embeddings import EmbeddingService
from engine.memory.types import MemoryEntry, MemoryType

log = logging.getLogger("mix.memory")

_COMMIT_BATCH_SIZE = 10
_CACHE_MAX = 100
_CACHE_TTL = 60


CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS memories (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    content TEXT NOT NULL,
    tags TEXT NOT NULL DEFAULT '[]',
    source TEXT NOT NULL DEFAULT '',
    session_id TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    accessed_at TEXT NOT NULL,
    access_count INTEGER NOT NULL DEFAULT 0,
    importance REAL NOT NULL DEFAULT 0.5
);

CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
    id, content, tags, source,
    content='memories',
    content_rowid='rowid'
);

CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
    INSERT INTO memories_fts(rowid, id, content, tags, source)
    VALUES (new.rowid, new.id, new.content, new.tags, new.source);
END;

CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
    INSERT INTO memories_fts(memories_fts, rowid, id, content, tags, source)
    VALUES ('delete', old.rowid, old.id, old.content, old.tags, old.source);
END;

CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS memory_vectors (
    memory_id TEXT PRIMARY KEY,
    embedding BLOB NOT NULL,
    FOREIGN KEY (memory_id) REFERENCES memories(id)
);
"""


class MemoryStore:
    def __init__(self, db_path: Path, use_embeddings: bool = True) -> None:
        self.db_path = db_path
        self._db: aiosqlite.Connection | None = None
        self._pending_writes = 0
        self._search_cache: dict[str, tuple[float, list[MemoryEntry]]] = {}
        self._embeddings = EmbeddingService() if use_embeddings else None

    async def connect(self) -> None:
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._db = await aiosqlite.connect(str(self.db_path))
        await self._db.executescript(CREATE_TABLE_SQL)
        await self._db.commit()

    async def close(self) -> None:
        if self._db:
            if self._pending_writes > 0:
                await self._db.commit()
            await self._db.close()
            self._db = None

    async def __aenter__(self) -> "MemoryStore":
        await self.connect()
        return self

    async def __aexit__(self, *exc: object) -> None:
        await self.close()

    async def store(self, entry: MemoryEntry) -> None:
        if self._db is None:
            raise RuntimeError("MemoryStore is not connected. Call connect() first.")
        await self._db.execute(
            "INSERT INTO memories "
            "(id, type, content, tags, source, session_id, created_at, accessed_at, access_count, importance) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                entry.id,
                entry.type.value,
                entry.content,
                json.dumps(entry.tags),
                entry.source,
                entry.session_id,
                entry.created_at,
                entry.accessed_at,
                entry.access_count,
                entry.importance,
            ),
        )
        self._pending_writes += 1
        self._invalidate_cache()
        if self._embeddings:
            try:
                vec = self._embeddings.encode(entry.content)
                blob = EmbeddingService.serialize_vector(vec)
                await self._db.execute(
                    "INSERT INTO memory_vectors (memory_id, embedding) VALUES (?, ?)",
                    (entry.id, blob),
                )
            except Exception:
                log.exception("Failed to store embedding for memory %s", entry.id)
        if self._pending_writes >= _COMMIT_BATCH_SIZE:
            await self._db.commit()
            self._pending_writes = 0

    async def search(self, query: str, limit: int = 10) -> list[MemoryEntry]:
        if self._pending_writes > 0:
            if self._db is None:
                raise RuntimeError("MemoryStore is not connected. Call connect() first.")
            await self._db.commit()
            self._pending_writes = 0

        cache_key = f"{query}:{limit}"
        now = time.time()
        cached = self._search_cache.get(cache_key)
        if cached and now - cached[0] < _CACHE_TTL:
            return cached[1]

        if self._db is None:
            raise RuntimeError("MemoryStore is not connected. Call connect() first.")

        fts_results = await self._fts_search(query, limit)
        vec_results = await self._vector_search(query, limit)
        results = self._reciprocal_rank_fusion(fts_results, vec_results, limit)

        if len(self._search_cache) >= _CACHE_MAX:
            oldest = min(self._search_cache, key=lambda k: self._search_cache[k][0])
            del self._search_cache[oldest]
        self._search_cache[cache_key] = (now, results)
        return results

    async def _fts_search(self, query: str, limit: int) -> list[MemoryEntry]:
        """Full-text search using FTS5."""
        if self._db is None:
            raise RuntimeError("MemoryStore is not connected. Call connect() first.")
        try:
            cursor = await self._db.execute(
                "SELECT m.* FROM memories m "
                "JOIN memories_fts f ON m.id = f.id "
                "WHERE memories_fts MATCH ? "
                "ORDER BY m.importance DESC, m.accessed_at DESC "
                "LIMIT ?",
                (query, limit),
            )
            rows = await cursor.fetchall()
            return [self._row_to_entry(row) for row in rows]
        except Exception:
            log.warning("FTS5 search failed for query: %r", query, exc_info=True)
            return []

    async def _vector_search(self, query: str, limit: int) -> list[MemoryEntry]:
        """Semantic search using vector embeddings."""
        if self._db is None:
            raise RuntimeError("MemoryStore is not connected. Call connect() first.")
        if not self._embeddings:
            return []
        try:
            query_vec = self._embeddings.encode(query)
            vec_cursor = await self._db.execute(
                "SELECT mv.memory_id, mv.embedding FROM memory_vectors mv LIMIT ?",
                (min(limit * 10, 1000),),
            )
            vec_rows = await vec_cursor.fetchall()
            scored: list[tuple[float, str]] = []
            for row in vec_rows:
                mem_id = row[0]
                stored_vec = EmbeddingService.deserialize_vector(row[1])
                sim = EmbeddingService.cosine_similarity(query_vec, stored_vec)
                scored.append((sim, mem_id))
            scored.sort(key=lambda x: x[0], reverse=True)
            top_ids = [sid for _, sid in scored[:limit]]
            if not top_ids:
                return []
            placeholders = ",".join("?" for _ in top_ids)
            entry_cursor = await self._db.execute(f"SELECT * FROM memories WHERE id IN ({placeholders})", top_ids)
            entry_rows = await entry_cursor.fetchall()
            vec_results = [self._row_to_entry(r) for r in entry_rows]
            id_to_entry = {e.id: e for e in vec_results}
            return [id_to_entry[sid] for sid in top_ids if sid in id_to_entry]
        except Exception:
            log.warning("Vector search failed for query: %r", query, exc_info=True)
            return []

    @staticmethod
    def _reciprocal_rank_fusion(
        fts_results: list[MemoryEntry],
        vec_results: list[MemoryEntry],
        limit: int,
    ) -> list[MemoryEntry]:
        """Merge FTS and vector results using Reciprocal Rank Fusion."""
        if not fts_results and not vec_results:
            return []
        if fts_results and not vec_results:
            return fts_results[:limit]
        if vec_results and not fts_results:
            return vec_results[:limit]
        k = 60
        scores: dict[str, float] = {}
        entry_map: dict[str, MemoryEntry] = {}
        for rank, entry in enumerate(fts_results):
            scores[entry.id] = scores.get(entry.id, 0) + 1 / (k + rank + 1)
            entry_map[entry.id] = entry
        for rank, entry in enumerate(vec_results):
            scores[entry.id] = scores.get(entry.id, 0) + 1 / (k + rank + 1)
            entry_map[entry.id] = entry
        sorted_ids = sorted(scores, key=scores.get, reverse=True)[:limit]  # type: ignore[arg-type]
        return [entry_map[mid] for mid in sorted_ids]

    async def ingest_document(self, text: str, chunk_size: int = 500, source: str = "") -> list[str]:
        overlap = 50
        chunks: list[str] = []
        start = 0
        while start < len(text):
            end = min(start + chunk_size, len(text))
            chunks.append(text[start:end])
            if end >= len(text):
                break
            start += chunk_size - overlap

        ids: list[str] = []
        for chunk in chunks:
            entry = MemoryEntry(
                type=MemoryType.CONTEXT,
                content=chunk,
                source=source or "document",
            )
            await self.store(entry)
            ids.append(entry.id)
        return ids

    async def get(self, entry_id: str) -> MemoryEntry | None:
        if self._db is None:
            raise RuntimeError("MemoryStore is not connected. Call connect() first.")
        if self._pending_writes > 0:
            await self._db.commit()
            self._pending_writes = 0
        cursor = await self._db.execute("SELECT * FROM memories WHERE id = ?", (entry_id,))
        row = await cursor.fetchone()
        if row is None:
            return None
        entry = self._row_to_entry(row)
        entry.touch()
        await self._db.execute(
            "UPDATE memories SET accessed_at = ?, access_count = ? WHERE id = ?",
            (entry.accessed_at, entry.access_count, entry.id),
        )
        await self._db.commit()
        return entry

    async def delete(self, entry_id: str) -> bool:
        if self._db is None:
            raise RuntimeError("MemoryStore is not connected. Call connect() first.")
        cursor = await self._db.execute("DELETE FROM memories WHERE id = ?", (entry_id,))
        self._pending_writes += 1
        self._invalidate_cache()
        if self._pending_writes >= _COMMIT_BATCH_SIZE:
            await self._db.commit()
            self._pending_writes = 0
        return cursor.rowcount > 0

    async def flush(self) -> None:
        if self._db and self._pending_writes > 0:
            await self._db.commit()
            self._pending_writes = 0

    def _invalidate_cache(self) -> None:
        self._search_cache.clear()

    async def get_recent(self, limit: int = 10) -> list[MemoryEntry]:
        if self._db is None:
            raise RuntimeError("MemoryStore is not connected. Call connect() first.")
        if self._pending_writes > 0:
            await self._db.commit()
            self._pending_writes = 0
        cursor = await self._db.execute("SELECT * FROM memories ORDER BY created_at DESC, rowid DESC LIMIT ?", (limit,))
        rows = await cursor.fetchall()
        return [self._row_to_entry(row) for row in rows]

    def _row_to_entry(self, row: Any) -> MemoryEntry:
        return MemoryEntry(
            id=row[0],
            type=MemoryType(row[1]),
            content=row[2],
            tags=json.loads(row[3]),
            source=row[4],
            session_id=row[5],
            created_at=row[6],
            accessed_at=row[7],
            access_count=row[8],
            importance=row[9],
        )

    # --- Session Persistence ---

    async def save_session(self, session_id: str, data: dict) -> None:
        if self._db is None:
            raise RuntimeError("MemoryStore is not connected. Call connect() first.")
        now = datetime.now(timezone.utc).isoformat()
        await self._db.execute(
            "INSERT OR REPLACE INTO sessions (id, data, updated_at) VALUES (?, ?, ?)",
            (session_id, json.dumps(data), now),
        )
        self._pending_writes += 1
        if self._pending_writes >= _COMMIT_BATCH_SIZE:
            await self._db.commit()
            self._pending_writes = 0

    async def load_session(self, session_id: str) -> dict | None:
        if self._db is None:
            raise RuntimeError("MemoryStore is not connected. Call connect() first.")
        cursor = await self._db.execute("SELECT data FROM sessions WHERE id = ?", (session_id,))
        row = await cursor.fetchone()
        if row is None:
            return None
        return json.loads(row[0])

    async def list_sessions(self) -> list[dict]:
        if self._db is None:
            raise RuntimeError("MemoryStore is not connected. Call connect() first.")
        cursor = await self._db.execute("SELECT id, updated_at FROM sessions ORDER BY updated_at DESC")
        rows = await cursor.fetchall()
        return [{"id": r[0], "updated_at": r[1]} for r in rows]

    async def delete_session(self, session_id: str) -> bool:
        if self._db is None:
            raise RuntimeError("MemoryStore is not connected. Call connect() first.")
        cursor = await self._db.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
        self._pending_writes += 1
        if self._pending_writes >= _COMMIT_BATCH_SIZE:
            await self._db.commit()
            self._pending_writes = 0
        return cursor.rowcount > 0

    async def search_sessions(self, query: str, limit: int = 20, offset: int = 0) -> list[dict]:
        if self._db is None:
            raise RuntimeError("MemoryStore is not connected. Call connect() first.")
        id_cursor = await self._db.execute(
            "SELECT id, data, updated_at FROM sessions WHERE id LIKE ? ORDER BY updated_at DESC LIMIT ? OFFSET ?",
            (f"%{query}%", limit, offset),
        )
        rows = await id_cursor.fetchall()
        if not rows:
            content_cursor = await self._db.execute(
                "SELECT id, data, updated_at FROM sessions WHERE data LIKE ? ORDER BY updated_at DESC LIMIT ? OFFSET ?",
                (f"%{query}%", limit, offset),
            )
            rows = await content_cursor.fetchall()
        results: list[dict] = []
        for r in rows:
            data = json.loads(r[1])
            results.append(
                {
                    "id": r[0],
                    "updated_at": r[2],
                    "message_count": len(data.get("messages", [])) if isinstance(data, dict) else 0,
                }
            )
        return results

    async def export_session(self, session_id: str, format: str = "json") -> dict | str | None:
        if self._db is None:
            raise RuntimeError("MemoryStore is not connected. Call connect() first.")
        cursor = await self._db.execute("SELECT id, data, updated_at FROM sessions WHERE id = ?", (session_id,))
        row = await cursor.fetchone()
        if row is None:
            return None
        data = json.loads(row[1])
        if format == "markdown":
            lines = [f"# Session {row[0]}", f"Updated: {row[2]}", ""]
            messages = data.get("messages", []) if isinstance(data, dict) else []
            for msg in messages:
                role = msg.get("role", "unknown")
                content = msg.get("content", "")
                lines.append(f"**{role}**: {content}")
                lines.append("")
            return "\n".join(lines)
        return {"id": row[0], "updated_at": row[2], "data": data}
