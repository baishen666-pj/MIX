from __future__ import annotations

from pathlib import Path


def extract_text(file_path: str, mime_type: str = "") -> str:
    path = Path(file_path)
    suffix = path.suffix.lower()

    if suffix == ".pdf" or "pdf" in mime_type:
        return _extract_pdf(path)
    elif suffix in (".docx", ".doc") or "wordprocessingml" in mime_type:
        return _extract_docx(path)
    elif suffix in (".txt", ".md", ".csv", ".json", ".html", ".xml"):
        return path.read_text(encoding="utf-8", errors="replace")
    else:
        return path.read_text(encoding="utf-8", errors="replace")


def _extract_pdf(path: Path) -> str:
    from PyPDF2 import PdfReader

    reader = PdfReader(str(path))
    pages = []
    for page in reader.pages:
        text = page.extract_text()
        if text:
            pages.append(text)
    return "\n\n".join(pages)


def _extract_docx(path: Path) -> str:
    from docx import Document

    doc = Document(str(path))
    return "\n\n".join(p.text for p in doc.paragraphs if p.text.strip())
