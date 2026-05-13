from __future__ import annotations

import logging
from dataclasses import dataclass, field
from enum import Enum

log = logging.getLogger("mix.chunking")


class ChunkingStrategy(str, Enum):
    FIXED = "fixed"
    RECURSIVE = "recursive"
    SEMANTIC = "semantic"


@dataclass
class Chunk:
    content: str
    index: int
    start_char: int
    end_char: int
    metadata: dict = field(default_factory=dict)


class Chunker:
    def __init__(self, strategy: ChunkingStrategy = ChunkingStrategy.RECURSIVE) -> None:
        self._strategy = strategy

    def chunk(
        self,
        text: str,
        metadata: dict | None = None,
        chunk_size: int = 500,
        overlap: int = 50,
    ) -> list[Chunk]:
        if self._strategy == ChunkingStrategy.FIXED:
            return self._fixed_chunk(text, metadata, chunk_size, overlap)
        elif self._strategy == ChunkingStrategy.RECURSIVE:
            return self._recursive_chunk(text, metadata, chunk_size, overlap)
        return self._fixed_chunk(text, metadata, chunk_size, overlap)

    def _fixed_chunk(
        self,
        text: str,
        metadata: dict | None,
        chunk_size: int,
        overlap: int,
    ) -> list[Chunk]:
        chunks = []
        start = 0
        idx = 0
        while start < len(text):
            end = min(start + chunk_size, len(text))
            chunks.append(
                Chunk(
                    content=text[start:end],
                    index=idx,
                    start_char=start,
                    end_char=end,
                    metadata=dict(metadata or {}),
                )
            )
            start += chunk_size - overlap
            idx += 1
        return chunks

    def _recursive_chunk(
        self,
        text: str,
        metadata: dict | None,
        chunk_size: int,
        overlap: int,
    ) -> list[Chunk]:
        separators = ["\n\n", "\n", ". ", " ", ""]
        result = self._split_recursive(text, separators, chunk_size)
        chunks = []
        for i, (start, content) in enumerate(result):
            chunks.append(
                Chunk(
                    content=content,
                    index=i,
                    start_char=start,
                    end_char=start + len(content),
                    metadata=dict(metadata or {}),
                )
            )
        return chunks

    def _split_recursive(
        self,
        text: str,
        separators: list[str],
        chunk_size: int,
    ) -> list[tuple[int, str]]:
        if len(text) <= chunk_size:
            return [(0, text)]

        if not separators:
            return [(i, text[i : i + chunk_size]) for i in range(0, len(text), chunk_size)]

        sep = separators[0]
        remaining_seps = separators[1:]

        parts = text.split(sep)
        result: list[tuple[int, str]] = []
        current = ""
        current_start = 0

        for part in parts:
            candidate = current + sep + part if current else part
            if len(candidate) <= chunk_size:
                current = candidate
            else:
                if current:
                    if len(current) > chunk_size:
                        result.extend(self._split_recursive(current, remaining_seps, chunk_size))
                    else:
                        result.append((current_start, current))
                current = part
                current_start = text.find(part, current_start)
        if current:
            if len(current) > chunk_size:
                result.extend(self._split_recursive(current, remaining_seps, chunk_size))
            else:
                result.append((current_start, current))
        return result
