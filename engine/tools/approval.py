from __future__ import annotations

import logging
import time
import uuid
from dataclasses import dataclass
from enum import Enum
from typing import Any

log = logging.getLogger("mix.approval")


class ApprovalStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXPIRED = "expired"


@dataclass
class ApprovalRequest:
    id: str
    tool_name: str
    arguments: dict[str, Any]
    danger_level: str
    requested_at: float
    status: ApprovalStatus = ApprovalStatus.PENDING
    resolved_at: float | None = None
    resolved_by: str | None = None
    reason: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "tool_name": self.tool_name,
            "arguments": self.arguments,
            "danger_level": self.danger_level,
            "status": self.status.value,
            "requested_at": self.requested_at,
            "resolved_at": self.resolved_at,
            "resolved_by": self.resolved_by,
            "reason": self.reason,
        }


class ApprovalManager:
    def __init__(self, auto_approve_safe: bool = True, ttl_seconds: int = 300) -> None:
        self._auto_approve_safe = auto_approve_safe
        self._ttl_seconds = ttl_seconds
        self._requests: dict[str, ApprovalRequest] = {}
        self._max_requests = 1000

    async def request_approval(
        self,
        tool_name: str,
        arguments: dict[str, Any],
        danger_level: str,
    ) -> ApprovalRequest:
        req = ApprovalRequest(
            id=uuid.uuid4().hex[:16],
            tool_name=tool_name,
            arguments=arguments,
            danger_level=danger_level,
            requested_at=time.time(),
        )

        if self._auto_approve_safe and danger_level == "safe":
            req.status = ApprovalStatus.APPROVED
            req.resolved_at = time.time()
            req.resolved_by = "auto"
            log.debug("Auto-approved safe tool: %s", tool_name)
        else:
            self._cleanup_expired()
            if len(self._requests) >= self._max_requests:
                oldest_id = min(self._requests, key=lambda k: self._requests[k].requested_at)
                del self._requests[oldest_id]
            self._requests[req.id] = req
            log.info("Approval requested for %s (%s): %s", tool_name, danger_level, req.id)

        return req

    async def approve(self, request_id: str, approver: str = "admin") -> bool:
        req = self._requests.get(request_id)
        if req is None or req.status != ApprovalStatus.PENDING:
            return False
        req.status = ApprovalStatus.APPROVED
        req.resolved_at = time.time()
        req.resolved_by = approver
        log.info("Approved %s by %s", request_id, approver)
        return True

    async def reject(self, request_id: str, approver: str = "admin", reason: str = "") -> bool:
        req = self._requests.get(request_id)
        if req is None or req.status != ApprovalStatus.PENDING:
            return False
        req.status = ApprovalStatus.REJECTED
        req.resolved_at = time.time()
        req.resolved_by = approver
        req.reason = reason
        log.info("Rejected %s by %s: %s", request_id, approver, reason)
        return True

    def get_pending(self) -> list[ApprovalRequest]:
        self._cleanup_expired()
        return [r for r in self._requests.values() if r.status == ApprovalStatus.PENDING]

    def get_request(self, request_id: str) -> ApprovalRequest | None:
        req = self._requests.get(request_id)
        if req and req.status == ApprovalStatus.PENDING:
            self._check_expiry(req)
        return req

    def _check_expiry(self, req: ApprovalRequest) -> None:
        if req.status == ApprovalStatus.PENDING:
            if time.time() - req.requested_at > self._ttl_seconds:
                req.status = ApprovalStatus.EXPIRED
                req.resolved_at = time.time()

    def _cleanup_expired(self) -> int:
        expired = 0
        to_remove: list[str] = []
        for req_id, req in self._requests.items():
            self._check_expiry(req)
            if req.status == ApprovalStatus.EXPIRED:
                to_remove.append(req_id)
                expired += 1
        for req_id in to_remove:
            del self._requests[req_id]
        return expired
