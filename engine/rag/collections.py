from __future__ import annotations

import json
import logging
import uuid
from dataclasses import dataclass, field

import aiosqlite

log = logging.getLogger("mix.collections")


@dataclass
class DocumentCollection:
    id: str
    name: str
    description: str
    created_at: str
    document_count: int = 0
    total_chunks: int = 0
    embedding_model: str = "all-MiniLM-L6-v2"
    metadata: dict = field(default_factory=dict)


@dataclass
class DocumentRecord:
    id: str
    collection_id: str
    filename: str
    mime_type: str
    size_bytes: int
    chunk_count: int
    created_at: str
    metadata: dict = field(default_factory=dict)


class CollectionManager:
    def __init__(self, db: aiosqlite.Connection) -> None:
        self._db = db

    async def initialize(self) -> None:
        self._db.row_factory = aiosqlite.Row
        await self._db.execute("""
            CREATE TABLE IF NOT EXISTS collections (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                description TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL,
                embedding_model TEXT NOT NULL DEFAULT 'all-MiniLM-L6-v2',
                metadata TEXT NOT NULL DEFAULT '{}'
            )
        """)
        await self._db.execute("""
            CREATE TABLE IF NOT EXISTS documents (
                id TEXT PRIMARY KEY,
                collection_id TEXT NOT NULL,
                filename TEXT NOT NULL,
                mime_type TEXT NOT NULL DEFAULT '',
                size_bytes INTEGER NOT NULL DEFAULT 0,
                chunk_count INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                metadata TEXT NOT NULL DEFAULT '{}',
                FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
            )
        """)
        await self._db.commit()

    async def create_collection(
        self,
        name: str,
        description: str = "",
        embedding_model: str = "all-MiniLM-L6-v2",
    ) -> DocumentCollection:
        coll_id = uuid.uuid4().hex[:12]
        from datetime import datetime

        coll = DocumentCollection(
            id=coll_id,
            name=name,
            description=description,
            created_at=datetime.utcnow().isoformat(),
            embedding_model=embedding_model,
        )
        await self._db.execute(
            "INSERT INTO collections "
            "(id, name, description, created_at, embedding_model, metadata) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (coll.id, coll.name, coll.description, coll.created_at, coll.embedding_model, json.dumps(coll.metadata)),
        )
        await self._db.commit()
        log.info("Created collection: %s (%s)", name, coll_id)
        return coll

    async def delete_collection(self, collection_id: str) -> bool:
        cursor = await self._db.execute("DELETE FROM collections WHERE id = ?", (collection_id,))
        await self._db.execute("DELETE FROM documents WHERE collection_id = ?", (collection_id,))
        await self._db.commit()
        return cursor.rowcount > 0

    async def list_collections(self) -> list[DocumentCollection]:
        cursor = await self._db.execute("SELECT * FROM collections ORDER BY created_at DESC")
        rows = await cursor.fetchall()
        result = []
        for row in rows:
            doc_cursor = await self._db.execute(
                "SELECT COUNT(*) as cnt FROM documents WHERE collection_id = ?", (row["id"],)
            )
            doc_row = await doc_cursor.fetchone()
            result.append(
                DocumentCollection(
                    id=row["id"],
                    name=row["name"],
                    description=row["description"],
                    created_at=row["created_at"],
                    embedding_model=row["embedding_model"],
                    metadata=json.loads(row["metadata"]),
                    document_count=doc_row["cnt"] if doc_row else 0,
                )
            )
        return result

    async def get_collection(self, collection_id: str) -> DocumentCollection | None:
        cursor = await self._db.execute("SELECT * FROM collections WHERE id = ?", (collection_id,))
        row = await cursor.fetchone()
        if row is None:
            return None
        doc_cursor = await self._db.execute(
            "SELECT COUNT(*) as cnt FROM documents WHERE collection_id = ?",
            (row["id"],),
        )
        doc_row = await doc_cursor.fetchone()
        doc_count = doc_row["cnt"] if doc_row else 0
        return DocumentCollection(
            id=row["id"],
            name=row["name"],
            description=row["description"],
            created_at=row["created_at"],
            embedding_model=row["embedding_model"],
            metadata=json.loads(row["metadata"]),
            document_count=doc_count,
        )

    async def add_document(
        self,
        collection_id: str,
        filename: str,
        mime_type: str,
        content: str,
        metadata: dict | None = None,
        chunk_count: int = 0,
    ) -> DocumentRecord:
        doc_id = uuid.uuid4().hex[:12]
        from datetime import datetime

        doc = DocumentRecord(
            id=doc_id,
            collection_id=collection_id,
            filename=filename,
            mime_type=mime_type,
            size_bytes=len(content.encode()),
            chunk_count=chunk_count,
            created_at=datetime.utcnow().isoformat(),
            metadata=metadata or {},
        )
        await self._db.execute(
            "INSERT INTO documents "
            "(id, collection_id, filename, mime_type, size_bytes, chunk_count, created_at, metadata) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (
                doc.id,
                doc.collection_id,
                doc.filename,
                doc.mime_type,
                doc.size_bytes,
                doc.chunk_count,
                doc.created_at,
                json.dumps(doc.metadata),
            ),
        )
        await self._db.commit()
        return doc

    async def delete_document(self, document_id: str) -> bool:
        cursor = await self._db.execute("DELETE FROM documents WHERE id = ?", (document_id,))
        await self._db.commit()
        return cursor.rowcount > 0

    async def list_documents(self, collection_id: str) -> list[DocumentRecord]:
        cursor = await self._db.execute(
            "SELECT * FROM documents WHERE collection_id = ? ORDER BY created_at DESC",
            (collection_id,),
        )
        rows = await cursor.fetchall()
        return [
            DocumentRecord(
                id=r["id"],
                collection_id=r["collection_id"],
                filename=r["filename"],
                mime_type=r["mime_type"],
                size_bytes=r["size_bytes"],
                chunk_count=r["chunk_count"],
                created_at=r["created_at"],
                metadata=json.loads(r["metadata"]),
            )
            for r in rows
        ]
