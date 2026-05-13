"""Tests for engine.utils.logging -- JSON formatter, setup, and get_logger."""

from __future__ import annotations

import json
import logging
import os
from unittest.mock import patch

from engine.utils.logging import (
    _JsonFormatter,
    get_logger,
    request_id_var,
    setup_logging,
)


class TestJsonFormatter:
    def test_format_produces_valid_json(self) -> None:
        # Arrange
        formatter = _JsonFormatter()
        record = logging.LogRecord(
            name="test.logger",
            level=logging.INFO,
            pathname="test.py",
            lineno=1,
            msg="hello world",
            args=None,
            exc_info=None,
        )

        # Act
        output = formatter.format(record)

        # Assert
        parsed = json.loads(output)
        assert parsed["message"] == "hello world"
        assert parsed["level"] == "info"
        assert parsed["logger"] == "test.logger"
        assert "timestamp" in parsed

    def test_format_includes_request_id_when_set(self) -> None:
        # Arrange
        formatter = _JsonFormatter()
        record = logging.LogRecord(
            name="test",
            level=logging.INFO,
            pathname="test.py",
            lineno=1,
            msg="with request id",
            args=None,
            exc_info=None,
        )
        token = request_id_var.set("req-abc-123")

        try:
            # Act
            output = formatter.format(record)

            # Assert
            parsed = json.loads(output)
            assert parsed["request_id"] == "req-abc-123"
        finally:
            request_id_var.reset(token)

    def test_format_omits_request_id_when_empty(self) -> None:
        # Arrange
        formatter = _JsonFormatter()
        record = logging.LogRecord(
            name="test",
            level=logging.INFO,
            pathname="test.py",
            lineno=1,
            msg="no request id",
            args=None,
            exc_info=None,
        )
        token = request_id_var.set("")
        try:
            # Act
            output = formatter.format(record)

            # Assert
            parsed = json.loads(output)
            assert "request_id" not in parsed
        finally:
            request_id_var.reset(token)

    def test_format_includes_exception_info(self) -> None:
        # Arrange
        formatter = _JsonFormatter()
        try:
            raise ValueError("test error")
        except ValueError:
            exc_info = logging.sys.exc_info()
        record = logging.LogRecord(
            name="test",
            level=logging.ERROR,
            pathname="test.py",
            lineno=1,
            msg="error occurred",
            args=None,
            exc_info=exc_info,
        )

        # Act
        output = formatter.format(record)

        # Assert
        parsed = json.loads(output)
        assert "exception" in parsed
        assert "ValueError" in parsed["exception"]
        assert "test error" in parsed["exception"]

    def test_format_merges_extra_fields(self) -> None:
        # Arrange
        formatter = _JsonFormatter()
        record = logging.LogRecord(
            name="test",
            level=logging.INFO,
            pathname="test.py",
            lineno=1,
            msg="extra fields",
            args=None,
            exc_info=None,
        )
        record.custom_key = "custom_value"
        record.request_path = "/api/test"

        # Act
        output = formatter.format(record)

        # Assert
        parsed = json.loads(output)
        assert parsed["custom_key"] == "custom_value"
        assert parsed["request_path"] == "/api/test"

    def test_format_excludes_standard_attrs(self) -> None:
        # Arrange
        formatter = _JsonFormatter()
        record = logging.LogRecord(
            name="test",
            level=logging.INFO,
            pathname="test.py",
            lineno=1,
            msg="clean output",
            args=None,
            exc_info=None,
        )

        # Act
        output = formatter.format(record)
        parsed = json.loads(output)

        # Assert -- standard logging internals should not leak
        assert "name" not in parsed
        assert "args" not in parsed
        assert "lineno" not in parsed
        assert "filename" not in parsed

    def test_format_excludes_private_attrs(self) -> None:
        # Arrange
        formatter = _JsonFormatter()
        record = logging.LogRecord(
            name="test",
            level=logging.INFO,
            pathname="test.py",
            lineno=1,
            msg="no privates",
            args=None,
            exc_info=None,
        )
        record._private_attr = "should not appear"

        # Act
        output = formatter.format(record)

        # Assert
        parsed = json.loads(output)
        assert "_private_attr" not in parsed

    def test_format_level_is_lowercase(self) -> None:
        # Arrange
        formatter = _JsonFormatter()
        record = logging.LogRecord(
            name="test",
            level=logging.WARNING,
            pathname="test.py",
            lineno=1,
            msg="warning msg",
            args=None,
            exc_info=None,
        )

        # Act
        output = formatter.format(record)

        # Assert
        parsed = json.loads(output)
        assert parsed["level"] == "warning"

    def test_format_with_message_args(self) -> None:
        # Arrange
        formatter = _JsonFormatter()
        record = logging.LogRecord(
            name="test",
            level=logging.INFO,
            pathname="test.py",
            lineno=1,
            msg="hello %s, count=%d",
            args=("world", 42),
            exc_info=None,
        )

        # Act
        output = formatter.format(record)

        # Assert
        parsed = json.loads(output)
        assert parsed["message"] == "hello world, count=42"


class TestSetupLogging:
    def test_setup_sets_root_logger_level(self) -> None:
        # Act
        setup_logging(level="DEBUG")

        # Assert
        root = logging.getLogger()
        assert root.level == logging.DEBUG

    def test_setup_clears_existing_handlers(self) -> None:
        # Arrange
        root = logging.getLogger()
        root.addHandler(logging.StreamHandler())
        initial_count = len(root.handlers)

        # Act
        setup_logging()

        # Assert -- should have exactly 1 handler (the new one)
        assert len(root.handlers) == 1
        assert len(root.handlers) != initial_count + 1

    def test_setup_uses_json_formatter(self) -> None:
        # Act
        setup_logging()

        # Assert
        root = logging.getLogger()
        handler = root.handlers[0]
        assert isinstance(handler.formatter, _JsonFormatter)

    def test_setup_respects_env_variable(self) -> None:
        # Arrange
        with patch.dict(os.environ, {"LOG_LEVEL": "WARNING"}):
            # Act
            setup_logging()

            # Assert
            root = logging.getLogger()
            assert root.level == logging.WARNING

    def test_setup_default_level_is_info(self) -> None:
        # Arrange -- ensure no LOG_LEVEL env var
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("LOG_LEVEL", None)
            # Act
            setup_logging()

            # Assert
            root = logging.getLogger()
            assert root.level == logging.INFO


class TestGetLogger:
    def test_returns_named_logger(self) -> None:
        # Act
        logger = get_logger("my.module")

        # Assert
        assert logger.name == "my.module"

    def test_returns_logger_instance(self) -> None:
        # Act
        logger = get_logger("test")

        # Assert
        assert isinstance(logger, logging.Logger)

    def test_different_names_return_different_loggers(self) -> None:
        # Act
        logger1 = get_logger("module.a")
        logger2 = get_logger("module.b")

        # Assert
        assert logger1 is not logger2
        assert logger1.name != logger2.name
