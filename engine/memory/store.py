from __future__ import annotations

import aiosqlite
from pathlib import Path

from engine.memory.types import MemoryEntry, MemoryType


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
"""


class MemoryStore:
    def __init__(self, db_path: Path) -> None:
        self.db_path = db_path
        self._db: aiosqlite.Connection | None = None

    async def connect(self) -> None:
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._db = await aiosqlite.connect(str(self.db_path))
        await self._db.executescript(CREATE_TABLE_SQL)
        await self._db.commit()

    async def close(self) -> None:
        if self._db:
            await self._db.close()
            self._db = None

    async def store(self, entry: MemoryEntry) -> None:
        assert self._db is not None
        import json
        await self._db.execute(
            "INSERT INTO memories (id, type, content, tags, source, session_id, created_at, accessed_at, access_count, importance) "
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
        await self._db.commit()

    async def search(self, query: str, limit: int = 10) -> list[MemoryEntry]:
        assert self._db is not None
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

    async def get(self, entry_id: str) -> MemoryEntry | None:
        assert self._db is not None
        cursor = await self._db.execute(
            "SELECT * FROM memories WHERE id = ?", (entry_id,)
        )
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
        assert self._db is not None
        cursor = await self._db.execute(
            "DELETE FROM memories WHERE id = ?", (entry_id,)
        )
        await self._db.commit()
        return cursor.rowcount > 0

    async def get_recent(self, limit: int = 10) -> list[MemoryEntry]:
        assert self._db is not None
        cursor = await self._db.execute(
            "SELECT * FROM memories ORDER BY created_at DESC LIMIT ?", (limit,)
        )
        rows = await cursor.fetchall()
        return [self._row_to_entry(row) for row in rows]

    def _row_to_entry(self, row: tuple) -> MemoryEntry:
        import json
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
        assert self._db is not None
        import json
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc).isoformat()
        await self._db.execute(
            "INSERT OR REPLACE INTO sessions (id, data, updated_at) VALUES (?, ?, ?)",
            (session_id, json.dumps(data), now),
        )
        await self._db.commit()

    async def load_session(self, session_id: str) -> dict | None:
        assert self._db is not None
        import json
        cursor = await self._db.execute(
            "SELECT data FROM sessions WHERE id = ?", (session_id,)
        )
        row = await cursor.fetchone()
        if row is None:
            return None
        return json.loads(row[0])

    async def list_sessions(self) -> list[dict]:
        assert self._db is not None
        cursor = await self._db.execute("SELECT id, updated_at FROM sessions ORDER BY updated_at DESC")
        rows = await cursor.fetchall()
        return [{"id": r[0], "updated_at": r[1]} for r in rows]

    async def delete_session(self, session_id: str) -> bool:
        assert self._db is not None
        cursor = await self._db.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
        await self._db.commit()
        return cursor.rowcount > 0
