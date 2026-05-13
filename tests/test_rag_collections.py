"""Comprehensive tests for engine.rag.collections module.

Covers CollectionManager CRUD operations, DocumentRecord management,
metadata handling, and edge cases using in-memory SQLite.
"""

from __future__ import annotations

import aiosqlite
import pytest

from engine.rag.collections import CollectionManager, DocumentCollection, DocumentRecord

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
async def db():
    """In-memory SQLite connection for isolated tests."""
    conn = await aiosqlite.connect(":memory:")
    yield conn
    await conn.close()


@pytest.fixture
async def collections(db):
    """Initialized CollectionManager with in-memory DB."""
    mgr = CollectionManager(db)
    await mgr.initialize()
    return mgr


# ---------------------------------------------------------------------------
# DocumentCollection dataclass
# ---------------------------------------------------------------------------


class TestDocumentCollection:
    """Tests for the DocumentCollection dataclass."""

    def test_default_values(self):
        coll = DocumentCollection(
            id="abc",
            name="test",
            description="",
            created_at="2024-01-01",
        )
        assert coll.document_count == 0
        assert coll.total_chunks == 0
        assert coll.embedding_model == "all-MiniLM-L6-v2"
        assert coll.metadata == {}

    def test_custom_values(self):
        coll = DocumentCollection(
            id="abc",
            name="test",
            description="A test collection",
            created_at="2024-01-01",
            document_count=5,
            total_chunks=20,
            embedding_model="custom-model",
            metadata={"key": "value"},
        )
        assert coll.document_count == 5
        assert coll.embedding_model == "custom-model"


# ---------------------------------------------------------------------------
# DocumentRecord dataclass
# ---------------------------------------------------------------------------


class TestDocumentRecord:
    """Tests for the DocumentRecord dataclass."""

    def test_default_metadata(self):
        doc = DocumentRecord(
            id="d1",
            collection_id="c1",
            filename="test.txt",
            mime_type="text/plain",
            size_bytes=100,
            chunk_count=1,
            created_at="2024-01-01",
        )
        assert doc.metadata == {}

    def test_custom_metadata(self):
        doc = DocumentRecord(
            id="d1",
            collection_id="c1",
            filename="test.txt",
            mime_type="text/plain",
            size_bytes=100,
            chunk_count=1,
            created_at="2024-01-01",
            metadata={"author": "alice", "version": 2},
        )
        assert doc.metadata["author"] == "alice"


# ---------------------------------------------------------------------------
# CollectionManager - initialization
# ---------------------------------------------------------------------------


class TestInitialization:
    @pytest.mark.asyncio
    async def test_initialize_creates_tables(self, db):
        mgr = CollectionManager(db)
        await mgr.initialize()

        cursor = await db.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = {row[0] for row in await cursor.fetchall()}
        assert "collections" in tables
        assert "documents" in tables

    @pytest.mark.asyncio
    async def test_initialize_is_idempotent(self, db):
        mgr = CollectionManager(db)
        await mgr.initialize()
        await mgr.initialize()  # Should not raise

        cursor = await db.execute("SELECT COUNT(*) FROM collections")
        count = (await cursor.fetchone())[0]
        assert count == 0


# ---------------------------------------------------------------------------
# CollectionManager - create_collection
# ---------------------------------------------------------------------------


class TestCreateCollection:
    @pytest.mark.asyncio
    async def test_create_returns_document_collection(self, collections):
        coll = await collections.create_collection("test_docs", description="Test")

        assert isinstance(coll, DocumentCollection)
        assert coll.name == "test_docs"
        assert coll.description == "Test"
        assert len(coll.id) > 0
        assert coll.created_at

    @pytest.mark.asyncio
    async def test_create_with_custom_embedding_model(self, collections):
        coll = await collections.create_collection(
            "custom_model",
            embedding_model="text-embedding-3-small",
        )

        assert coll.embedding_model == "text-embedding-3-small"

    @pytest.mark.asyncio
    async def test_create_with_default_embedding_model(self, collections):
        coll = await collections.create_collection("default_model")

        assert coll.embedding_model == "all-MiniLM-L6-v2"

    @pytest.mark.asyncio
    async def test_create_duplicate_name_raises_error(self, collections):
        await collections.create_collection("unique_name")

        with pytest.raises(Exception):
            await collections.create_collection("unique_name")

    @pytest.mark.asyncio
    async def test_created_collection_has_zero_documents(self, collections):
        coll = await collections.create_collection("empty_coll")
        retrieved = await collections.get_collection(coll.id)

        assert retrieved is not None
        assert retrieved.document_count == 0


# ---------------------------------------------------------------------------
# CollectionManager - get_collection
# ---------------------------------------------------------------------------


class TestGetCollection:
    @pytest.mark.asyncio
    async def test_get_existing_collection(self, collections):
        created = await collections.create_collection("findable", description="Find me")
        retrieved = await collections.get_collection(created.id)

        assert retrieved is not None
        assert retrieved.name == "findable"
        assert retrieved.description == "Find me"
        assert retrieved.id == created.id

    @pytest.mark.asyncio
    async def test_get_nonexistent_collection_returns_none(self, collections):
        result = await collections.get_collection("does_not_exist")

        assert result is None

    @pytest.mark.asyncio
    async def test_get_reflects_document_count(self, collections):
        coll = await collections.create_collection("with_docs")
        await collections.add_document(coll.id, "doc1.txt", "text/plain", "content")
        await collections.add_document(coll.id, "doc2.txt", "text/plain", "content")

        retrieved = await collections.get_collection(coll.id)

        assert retrieved is not None
        assert retrieved.document_count == 2


# ---------------------------------------------------------------------------
# CollectionManager - list_collections
# ---------------------------------------------------------------------------


class TestListCollections:
    @pytest.mark.asyncio
    async def test_list_empty_returns_empty(self, collections):
        result = await collections.list_collections()

        assert result == []

    @pytest.mark.asyncio
    async def test_list_returns_all_collections(self, collections):
        await collections.create_collection("coll_a")
        await collections.create_collection("coll_b")
        await collections.create_collection("coll_c")

        result = await collections.list_collections()

        names = {c.name for c in result}
        assert names == {"coll_a", "coll_b", "coll_c"}

    @pytest.mark.asyncio
    async def test_list_reflects_document_counts(self, collections):
        coll1 = await collections.create_collection("has_docs")
        coll2 = await collections.create_collection("no_docs")
        await collections.add_document(coll1.id, "file.txt", "text/plain", "content")

        result = await collections.list_collections()

        result_by_name = {c.name: c for c in result}
        assert result_by_name["has_docs"].document_count == 1
        assert result_by_name["no_docs"].document_count == 0


# ---------------------------------------------------------------------------
# CollectionManager - delete_collection
# ---------------------------------------------------------------------------


class TestDeleteCollection:
    @pytest.mark.asyncio
    async def test_delete_existing_collection(self, collections):
        coll = await collections.create_collection("to_delete")

        deleted = await collections.delete_collection(coll.id)

        assert deleted is True
        assert await collections.get_collection(coll.id) is None

    @pytest.mark.asyncio
    async def test_delete_nonexistent_returns_false(self, collections):
        deleted = await collections.delete_collection("nonexistent_id")

        assert deleted is False

    @pytest.mark.asyncio
    async def test_delete_collection_removes_associated_documents(self, collections):
        coll = await collections.create_collection("doomed")
        doc = await collections.add_document(coll.id, "file.txt", "text/plain", "content")

        await collections.delete_collection(coll.id)

        docs = await collections.list_documents(coll.id)
        assert len(docs) == 0


# ---------------------------------------------------------------------------
# CollectionManager - add_document
# ---------------------------------------------------------------------------


class TestAddDocument:
    @pytest.mark.asyncio
    async def test_add_returns_document_record(self, collections):
        coll = await collections.create_collection("docs")
        doc = await collections.add_document(
            coll.id,
            "report.pdf",
            "application/pdf",
            "PDF content here",
        )

        assert isinstance(doc, DocumentRecord)
        assert doc.filename == "report.pdf"
        assert doc.mime_type == "application/pdf"
        assert doc.collection_id == coll.id
        assert len(doc.id) > 0

    @pytest.mark.asyncio
    async def test_size_bytes_matches_content_length(self, collections):
        coll = await collections.create_collection("docs")
        content = "Hello, world!"
        doc = await collections.add_document(coll.id, "hello.txt", "text/plain", content)

        assert doc.size_bytes == len(content.encode())

    @pytest.mark.asyncio
    async def test_size_bytes_with_unicode(self, collections):
        coll = await collections.create_collection("docs")
        content = "Unicode content"
        doc = await collections.add_document(coll.id, "uni.txt", "text/plain", content)

        assert doc.size_bytes == len(content.encode())

    @pytest.mark.asyncio
    async def test_chunk_count_stored(self, collections):
        coll = await collections.create_collection("docs")
        doc = await collections.add_document(
            coll.id,
            "chunked.txt",
            "text/plain",
            "content",
            chunk_count=7,
        )

        assert doc.chunk_count == 7

    @pytest.mark.asyncio
    async def test_chunk_count_default_zero(self, collections):
        coll = await collections.create_collection("docs")
        doc = await collections.add_document(
            coll.id,
            "no_chunks.txt",
            "text/plain",
            "content",
        )

        assert doc.chunk_count == 0

    @pytest.mark.asyncio
    async def test_metadata_stored(self, collections):
        coll = await collections.create_collection("docs")
        meta = {"author": "bob", "tags": ["important", "review"]}
        doc = await collections.add_document(
            coll.id,
            "meta.txt",
            "text/plain",
            "content",
            metadata=meta,
        )

        assert doc.metadata["author"] == "bob"
        assert doc.metadata["tags"] == ["important", "review"]

    @pytest.mark.asyncio
    async def test_metadata_default_empty_dict(self, collections):
        coll = await collections.create_collection("docs")
        doc = await collections.add_document(
            coll.id,
            "nometa.txt",
            "text/plain",
            "content",
            metadata=None,
        )

        assert doc.metadata == {}

    @pytest.mark.asyncio
    async def test_created_at_is_set(self, collections):
        coll = await collections.create_collection("docs")
        doc = await collections.add_document(coll.id, "time.txt", "text/plain", "c")

        assert doc.created_at
        assert "T" in doc.created_at  # ISO format check


# ---------------------------------------------------------------------------
# CollectionManager - list_documents
# ---------------------------------------------------------------------------


class TestListDocuments:
    @pytest.mark.asyncio
    async def test_list_empty_returns_empty(self, collections):
        coll = await collections.create_collection("docs")
        docs = await collections.list_documents(coll.id)

        assert docs == []

    @pytest.mark.asyncio
    async def test_list_returns_all_documents_in_collection(self, collections):
        coll = await collections.create_collection("docs")
        await collections.add_document(coll.id, "a.txt", "text/plain", "aaa")
        await collections.add_document(coll.id, "b.txt", "text/plain", "bbb")

        docs = await collections.list_documents(coll.id)

        assert len(docs) == 2
        filenames = {d.filename for d in docs}
        assert filenames == {"a.txt", "b.txt"}

    @pytest.mark.asyncio
    async def test_list_only_returns_documents_for_given_collection(self, collections):
        coll1 = await collections.create_collection("coll1")
        coll2 = await collections.create_collection("coll2")
        await collections.add_document(coll1.id, "c1_doc.txt", "text/plain", "x")
        await collections.add_document(coll2.id, "c2_doc.txt", "text/plain", "y")

        docs1 = await collections.list_documents(coll1.id)
        docs2 = await collections.list_documents(coll2.id)

        assert len(docs1) == 1
        assert docs1[0].filename == "c1_doc.txt"
        assert len(docs2) == 1
        assert docs2[0].filename == "c2_doc.txt"


# ---------------------------------------------------------------------------
# CollectionManager - delete_document
# ---------------------------------------------------------------------------


class TestDeleteDocument:
    @pytest.mark.asyncio
    async def test_delete_existing_document(self, collections):
        coll = await collections.create_collection("docs")
        doc = await collections.add_document(coll.id, "del.txt", "text/plain", "content")

        deleted = await collections.delete_document(doc.id)

        assert deleted is True
        docs = await collections.list_documents(coll.id)
        assert len(docs) == 0

    @pytest.mark.asyncio
    async def test_delete_nonexistent_returns_false(self, collections):
        deleted = await collections.delete_document("nonexistent_id")

        assert deleted is False

    @pytest.mark.asyncio
    async def test_delete_one_of_many_preserves_others(self, collections):
        coll = await collections.create_collection("docs")
        doc1 = await collections.add_document(coll.id, "keep.txt", "text/plain", "aaa")
        doc2 = await collections.add_document(coll.id, "remove.txt", "text/plain", "bbb")

        await collections.delete_document(doc2.id)

        docs = await collections.list_documents(coll.id)
        assert len(docs) == 1
        assert docs[0].filename == "keep.txt"
