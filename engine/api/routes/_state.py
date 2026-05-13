"""Internal helpers for the routes package.

This module exists so sub-modules can ``from engine.api.routes._state import ...``
if they need shared constants.  Mutable state lives as module-level
attributes on the ``engine.api.routes`` package itself.
"""

from __future__ import annotations
