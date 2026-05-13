"""Tests for engine.memory.document_parser — text extraction from files."""

from __future__ import annotations

from pathlib import Path

import pytest

from engine.memory.document_parser import extract_text


class TestExtractText:
    def test_extract_text_file(self, tmp_path: Path) -> None:
        f = tmp_path / "sample.txt"
        f.write_text("Hello, world!", encoding="utf-8")

        text = extract_text(str(f))
        assert text == "Hello, world!"

    def test_extract_markdown_file(self, tmp_path: Path) -> None:
        f = tmp_path / "doc.md"
        f.write_text("# Title\n\nSome **bold** text.", encoding="utf-8")

        text = extract_text(str(f))
        assert "# Title" in text
        assert "bold" in text

    def test_extract_csv_file(self, tmp_path: Path) -> None:
        f = tmp_path / "data.csv"
        f.write_text("name,age\nAlice,30\nBob,25", encoding="utf-8")

        text = extract_text(str(f))
        assert "Alice" in text
        assert "Bob" in text

    def test_extract_json_file(self, tmp_path: Path) -> None:
        f = tmp_path / "config.json"
        f.write_text('{"key": "value"}', encoding="utf-8")

        text = extract_text(str(f))
        assert "value" in text

    def test_extract_html_file(self, tmp_path: Path) -> None:
        f = tmp_path / "page.html"
        f.write_text("<html><body>Hello</body></html>", encoding="utf-8")

        text = extract_text(str(f))
        assert "Hello" in text

    def test_extract_xml_file(self, tmp_path: Path) -> None:
        f = tmp_path / "data.xml"
        f.write_text("<root><item>test</item></root>", encoding="utf-8")

        text = extract_text(str(f))
        assert "test" in text

    def test_extract_unknown_extension_reads_as_text(self, tmp_path: Path) -> None:
        f = tmp_path / "data.log"
        f.write_text("log line 1\nlog line 2", encoding="utf-8")

        text = extract_text(str(f))
        assert "log line 1" in text

    def test_extract_with_mime_type_pdf_hint(self, tmp_path: Path) -> None:
        f = tmp_path / "binary.bin"
        f.write_bytes(b"not a real pdf")

        # Minimal PDF without proper structure raises PdfReadError
        with pytest.raises(Exception):
            extract_text(str(f), mime_type="application/pdf")

    def test_extract_with_encoding_errors(self, tmp_path: Path) -> None:
        f = tmp_path / "mixed.txt"
        f.write_bytes(b"Hello \xff\xfe World")

        text = extract_text(str(f))
        assert "Hello" in text
        # Should not raise on encoding errors
