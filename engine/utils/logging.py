"""Structured JSON logging for the MIX engine.

Uses stdlib only -- no external dependencies required.
Falls back to structlog if available for richer output.
"""

from __future__ import annotations

import json
import logging
import os
import sys
from contextvars import ContextVar
from datetime import datetime, timezone
from typing import Any

# Context variable propagated per-request by the middleware.
request_id_var: ContextVar[str] = ContextVar("request_id", default="")


class _JsonFormatter(logging.Formatter):
    """Emit every log record as a single JSON line."""

    def format(self, record: logging.LogRecord) -> str:
        entry: dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname.lower(),
            "message": record.getMessage(),
            "logger": record.name,
        }

        rid = request_id_var.get("")
        if rid:
            entry["request_id"] = rid

        if record.exc_info and record.exc_info[1] is not None:
            entry["exception"] = self.formatException(record.exc_info)

        # Merge any extra fields the caller attached via ``extra={...}``.
        standard_attrs = {
            "name",
            "msg",
            "args",
            "created",
            "filename",
            "funcName",
            "levelname",
            "levelno",
            "lineno",
            "module",
            "msecs",
            "message",
            "pathname",
            "process",
            "processName",
            "relativeCreated",
            "thread",
            "threadName",
            "exc_info",
            "exc_text",
            "stack_info",
            "taskName",
        }
        for key, value in record.__dict__.items():
            if key not in standard_attrs and not key.startswith("_"):
                entry[key] = value

        return json.dumps(entry, default=str)


def setup_logging(level: str | None = None) -> None:
    """Configure the root logger for JSON output.

    ``level`` defaults to the ``LOG_LEVEL`` env var, or ``INFO``.
    """
    effective_level = level or os.environ.get("LOG_LEVEL", "INFO").upper()

    handler = logging.StreamHandler(sys.stderr)
    handler.setFormatter(_JsonFormatter())

    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(getattr(logging, effective_level, logging.INFO))


def get_logger(name: str) -> logging.Logger:
    """Return a named logger.

    Call ``setup_logging()`` once at application start; after that every
    logger retrieved through this helper will automatically produce JSON.
    """
    return logging.getLogger(name)
