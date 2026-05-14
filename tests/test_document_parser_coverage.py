"""Additional coverage for engine.memory.document_parser.

Targets uncovered lines:
- Line 13: _extract_docx path
- Lines 24-29: _extract_pdf with actual PDF pages
- Lines 33-36: _extract_docx with actual paragraphs
- Edge cases: empty PDF, binary file, unsupported mime type
"""

from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock, patch

from engine.memory.document_parser import _extract_docx, _extract_pdf, extract_text

# --- _extract_pdf (lines 24-29) ---


class TestExtractPdf:
    def test_extract_pdf_with_pages(self, tmp_path: Path):
        """_extract_pdf reads pages from PDF and joins with double newlines."""
        mock_page1 = MagicMock()
        mock_page1.extract_text.return_value = "Page one content"
        mock_page2 = MagicMock()
        mock_page2.extract_text.return_value = "Page two content"

        mock_reader = MagicMock()
        mock_reader.pages = [mock_page1, mock_page2]

        with patch("pypdf.PdfReader", return_value=mock_reader):
            pdf_path = tmp_path / "test.pdf"
            pdf_path.write_bytes(b"%PDF-1.4 fake")
            result = _extract_pdf(pdf_path)
            assert result == "Page one content\n\nPage two content"

    def test_extract_pdf_skips_empty_pages(self, tmp_path: Path):
        """Pages with no extractable text are skipped."""
        mock_page1 = MagicMock()
        mock_page1.extract_text.return_value = "Has text"
        mock_page2 = MagicMock()
        mock_page2.extract_text.return_value = ""  # empty
        mock_page3 = MagicMock()
        mock_page3.extract_text.return_value = None  # None

        mock_reader = MagicMock()
        mock_reader.pages = [mock_page1, mock_page2, mock_page3]

        with patch("pypdf.PdfReader", return_value=mock_reader):
            pdf_path = tmp_path / "empty_pages.pdf"
            pdf_path.write_bytes(b"%PDF-1.4 fake")
            result = _extract_pdf(pdf_path)
            assert result == "Has text"

    def test_extract_pdf_empty_document(self, tmp_path: Path):
        """PDF with no pages returns empty string."""
        mock_reader = MagicMock()
        mock_reader.pages = []

        with patch("pypdf.PdfReader", return_value=mock_reader):
            pdf_path = tmp_path / "empty.pdf"
            pdf_path.write_bytes(b"%PDF-1.4 fake")
            result = _extract_pdf(pdf_path)
            assert result == ""

    def test_extract_pdf_single_page(self, tmp_path: Path):
        """Single-page PDF returns page text without join separator."""
        mock_page = MagicMock()
        mock_page.extract_text.return_value = "Only page"

        mock_reader = MagicMock()
        mock_reader.pages = [mock_page]

        with patch("pypdf.PdfReader", return_value=mock_reader):
            pdf_path = tmp_path / "single.pdf"
            pdf_path.write_bytes(b"%PDF-1.4 fake")
            result = _extract_pdf(pdf_path)
            assert result == "Only page"


# --- _extract_docx (lines 33-36) ---


class TestExtractDocx:
    def test_extract_docx_with_paragraphs(self, tmp_path: Path):
        """_extract_docx joins paragraph texts, skipping empty ones."""
        mock_para1 = MagicMock()
        mock_para1.text = "First paragraph"
        mock_para2 = MagicMock()
        mock_para2.text = "   "  # whitespace only
        mock_para3 = MagicMock()
        mock_para3.text = "Third paragraph"

        mock_doc = MagicMock()
        mock_doc.paragraphs = [mock_para1, mock_para2, mock_para3]

        with patch("docx.Document", return_value=mock_doc):
            docx_path = tmp_path / "test.docx"
            docx_path.write_bytes(b"PK fake docx")
            result = _extract_docx(docx_path)
            assert result == "First paragraph\n\nThird paragraph"

    def test_extract_docx_empty_document(self, tmp_path: Path):
        """DOCX with no paragraphs returns empty string."""
        mock_doc = MagicMock()
        mock_doc.paragraphs = []

        with patch("docx.Document", return_value=mock_doc):
            docx_path = tmp_path / "empty.docx"
            docx_path.write_bytes(b"PK fake docx")
            result = _extract_docx(docx_path)
            assert result == ""

    def test_extract_docx_all_empty_paragraphs(self, tmp_path: Path):
        """DOCX with only whitespace paragraphs returns empty string."""
        mock_para1 = MagicMock()
        mock_para1.text = "  "
        mock_para2 = MagicMock()
        mock_para2.text = ""

        mock_doc = MagicMock()
        mock_doc.paragraphs = [mock_para1, mock_para2]

        with patch("docx.Document", return_value=mock_doc):
            docx_path = tmp_path / "blank.docx"
            docx_path.write_bytes(b"PK fake docx")
            result = _extract_docx(docx_path)
            assert result == ""


# --- extract_text dispatcher routing ---


class TestExtractTextDispatch:
    def test_routes_to_pdf_by_suffix(self, tmp_path: Path):
        """Files with .pdf suffix are routed to _extract_pdf."""
        pdf_path = tmp_path / "doc.pdf"
        pdf_path.write_bytes(b"%PDF-1.4 fake")

        with patch("engine.memory.document_parser._extract_pdf", return_value="pdf text") as mock_pdf:
            result = extract_text(str(pdf_path))
            mock_pdf.assert_called_once()
            assert result == "pdf text"

    def test_routes_to_pdf_by_mime_type(self, tmp_path: Path):
        """Files with PDF mime_type are routed to _extract_pdf regardless of suffix."""
        bin_path = tmp_path / "document.bin"
        bin_path.write_bytes(b"binary data")

        with patch("engine.memory.document_parser._extract_pdf", return_value="extracted pdf") as mock_pdf:
            result = extract_text(str(bin_path), mime_type="application/pdf")
            mock_pdf.assert_called_once()
            assert result == "extracted pdf"

    def test_routes_to_docx_by_suffix(self, tmp_path: Path):
        """Files with .docx suffix are routed to _extract_docx."""
        docx_path = tmp_path / "doc.docx"
        docx_path.write_bytes(b"PK docx")

        with patch("engine.memory.document_parser._extract_docx", return_value="docx text") as mock_docx:
            result = extract_text(str(docx_path))
            mock_docx.assert_called_once()
            assert result == "docx text"

    def test_routes_to_docx_by_doc_suffix(self, tmp_path: Path):
        """Files with .doc suffix are routed to _extract_docx."""
        doc_path = tmp_path / "legacy.doc"
        doc_path.write_bytes(b"legacy doc")

        with patch("engine.memory.document_parser._extract_docx", return_value="doc text") as mock_docx:
            result = extract_text(str(doc_path))
            mock_docx.assert_called_once()
            assert result == "doc text"

    def test_routes_to_docx_by_mime_type(self, tmp_path: Path):
        """Files with wordprocessingml mime_type are routed to _extract_docx."""
        bin_path = tmp_path / "doc.bin"
        bin_path.write_bytes(b"binary")

        with patch("engine.memory.document_parser._extract_docx", return_value="docx from mime") as mock_docx:
            result = extract_text(
                str(bin_path),
                mime_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            )
            mock_docx.assert_called_once()
            assert result == "docx from mime"


# --- Binary file handling ---


class TestBinaryHandling:
    def test_binary_file_reads_as_text_fallback(self, tmp_path: Path):
        """Unknown binary file falls through to read_text with error replacement."""
        bin_file = tmp_path / "image.png"
        bin_file.write_bytes(b"\x89PNG\r\n\x1a\nfriendly text")
        result = extract_text(str(bin_file))
        # Should not raise; may contain replacement characters
        assert isinstance(result, str)

    def test_empty_file_returns_empty(self, tmp_path: Path):
        """Empty file returns empty string."""
        empty = tmp_path / "empty.txt"
        empty.write_text("", encoding="utf-8")
        result = extract_text(str(empty))
        assert result == ""

    def test_unsupported_mime_type_reads_as_text(self, tmp_path: Path):
        """Unsupported mime type falls through to default read_text."""
        f = tmp_path / "data.dat"
        f.write_text("plain text data", encoding="utf-8")
        result = extract_text(str(f), mime_type="application/x-unknown")
        assert "plain text data" in result
