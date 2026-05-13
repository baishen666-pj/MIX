"""Comprehensive tests for engine.tools.approval module.

Covers: ApprovalStatus, ApprovalRequest, ApprovalManager
Edge cases: expiry, double approve/reject, non-existent requests, serialization.
"""

from __future__ import annotations

import time

import pytest

from engine.tools.approval import ApprovalManager, ApprovalRequest, ApprovalStatus

# --- ApprovalStatus ---


class TestApprovalStatus:
    def test_status_values(self):
        assert ApprovalStatus.PENDING == "pending"
        assert ApprovalStatus.APPROVED == "approved"
        assert ApprovalStatus.REJECTED == "rejected"
        assert ApprovalStatus.EXPIRED == "expired"

    def test_status_is_str_enum(self):
        for member in ApprovalStatus:
            assert isinstance(member, str)
            assert isinstance(member, ApprovalStatus)


# --- ApprovalRequest ---


class TestApprovalRequest:
    def test_to_dict_contains_all_fields(self):
        req = ApprovalRequest(
            id="abc123",
            tool_name="bash",
            arguments={"command": "ls"},
            danger_level="dangerous",
            requested_at=1000.0,
        )
        d = req.to_dict()
        assert d["id"] == "abc123"
        assert d["tool_name"] == "bash"
        assert d["arguments"] == {"command": "ls"}
        assert d["danger_level"] == "dangerous"
        assert d["status"] == "pending"
        assert d["resolved_at"] is None
        assert d["resolved_by"] is None
        assert d["reason"] is None

    def test_to_dict_after_resolution(self):
        req = ApprovalRequest(
            id="xyz",
            tool_name="bash",
            arguments={},
            danger_level="dangerous",
            requested_at=0.0,
            status=ApprovalStatus.REJECTED,
            resolved_at=100.0,
            resolved_by="admin",
            reason="Unsafe",
        )
        d = req.to_dict()
        assert d["status"] == "rejected"
        assert d["resolved_by"] == "admin"
        assert d["reason"] == "Unsafe"


# --- ApprovalManager ---


@pytest.fixture
def mgr() -> ApprovalManager:
    return ApprovalManager(auto_approve_safe=True, ttl_seconds=300)


class TestAutoApprove:
    @pytest.mark.asyncio
    async def test_safe_tools_auto_approved(self, mgr: ApprovalManager):
        req = await mgr.request_approval("file_read", {"path": "/etc/hosts"}, "safe")
        assert req.status == ApprovalStatus.APPROVED
        assert req.resolved_by == "auto"
        assert req.resolved_at is not None

    @pytest.mark.asyncio
    async def test_safe_tools_not_stored_in_pending(self, mgr: ApprovalManager):
        await mgr.request_approval("file_read", {"path": "."}, "safe")
        assert len(mgr.get_pending()) == 0

    @pytest.mark.asyncio
    async def test_moderate_tools_require_approval(self, mgr: ApprovalManager):
        req = await mgr.request_approval("file_write", {"path": "/tmp/x", "content": "hi"}, "moderate")
        assert req.status == ApprovalStatus.PENDING

    @pytest.mark.asyncio
    async def test_dangerous_tools_require_approval(self, mgr: ApprovalManager):
        req = await mgr.request_approval("bash", {"command": "rm -rf /"}, "dangerous")
        assert req.status == ApprovalStatus.PENDING


class TestManualApproval:
    @pytest.mark.asyncio
    async def test_approve_pending_request(self, mgr: ApprovalManager):
        req = await mgr.request_approval("bash", {"command": "ls"}, "dangerous")
        result = await mgr.approve(req.id, "user1")
        assert result is True
        assert req.status == ApprovalStatus.APPROVED
        assert req.resolved_by == "user1"

    @pytest.mark.asyncio
    async def test_reject_pending_request(self, mgr: ApprovalManager):
        req = await mgr.request_approval("bash", {"command": "ls"}, "dangerous")
        result = await mgr.reject(req.id, "admin", reason="Blocked by policy")
        assert result is True
        assert req.status == ApprovalStatus.REJECTED
        assert req.resolved_by == "admin"
        assert req.reason == "Blocked by policy"

    @pytest.mark.asyncio
    async def test_approve_already_approved_returns_false(self, mgr: ApprovalManager):
        req = await mgr.request_approval("bash", {"command": "ls"}, "dangerous")
        await mgr.approve(req.id, "admin")
        second = await mgr.approve(req.id, "admin")
        assert second is False

    @pytest.mark.asyncio
    async def test_reject_already_rejected_returns_false(self, mgr: ApprovalManager):
        req = await mgr.request_approval("bash", {"command": "ls"}, "dangerous")
        await mgr.reject(req.id, "admin")
        second = await mgr.reject(req.id, "admin")
        assert second is False

    @pytest.mark.asyncio
    async def test_approve_after_reject_returns_false(self, mgr: ApprovalManager):
        req = await mgr.request_approval("bash", {"command": "ls"}, "dangerous")
        await mgr.reject(req.id, "admin")
        result = await mgr.approve(req.id, "admin")
        assert result is False

    @pytest.mark.asyncio
    async def test_approve_nonexistent_returns_false(self, mgr: ApprovalManager):
        result = await mgr.approve("does_not_exist", "admin")
        assert result is False

    @pytest.mark.asyncio
    async def test_reject_nonexistent_returns_false(self, mgr: ApprovalManager):
        result = await mgr.reject("does_not_exist", "admin")
        assert result is False


class TestPendingQueue:
    @pytest.mark.asyncio
    async def test_get_pending_returns_only_pending(self, mgr: ApprovalManager):
        r1 = await mgr.request_approval("bash", {"command": "a"}, "dangerous")
        r2 = await mgr.request_approval("bash", {"command": "b"}, "dangerous")
        await mgr.approve(r1.id, "admin")
        pending = mgr.get_pending()
        assert len(pending) == 1
        assert pending[0].id == r2.id

    @pytest.mark.asyncio
    async def test_get_pending_empty(self, mgr: ApprovalManager):
        assert len(mgr.get_pending()) == 0

    @pytest.mark.asyncio
    async def test_get_request_by_id(self, mgr: ApprovalManager):
        req = await mgr.request_approval("bash", {"command": "ls"}, "dangerous")
        fetched = mgr.get_request(req.id)
        assert fetched is not None
        assert fetched.id == req.id

    @pytest.mark.asyncio
    async def test_get_request_nonexistent_returns_none(self, mgr: ApprovalManager):
        assert mgr.get_request("nonexistent") is None


class TestExpiry:
    @pytest.mark.asyncio
    async def test_expired_request_detected_on_get(self):
        short_mgr = ApprovalManager(auto_approve_safe=False, ttl_seconds=0)
        req = await short_mgr.request_approval("bash", {"command": "ls"}, "dangerous")
        time.sleep(0.01)
        fetched = short_mgr.get_request(req.id)
        assert fetched is not None
        assert fetched.status == ApprovalStatus.EXPIRED

    @pytest.mark.asyncio
    async def test_expired_cleaned_from_pending(self):
        short_mgr = ApprovalManager(auto_approve_safe=False, ttl_seconds=0)
        await short_mgr.request_approval("bash", {"command": "ls"}, "dangerous")
        time.sleep(0.01)
        pending = short_mgr.get_pending()
        assert len(pending) == 0


class TestNoAutoApprove:
    @pytest.mark.asyncio
    async def test_safe_requires_manual_when_auto_disabled(self):
        strict = ApprovalManager(auto_approve_safe=False)
        req = await strict.request_approval("file_read", {"path": "."}, "safe")
        assert req.status == ApprovalStatus.PENDING

    @pytest.mark.asyncio
    async def test_can_manually_approve_when_auto_disabled(self):
        strict = ApprovalManager(auto_approve_safe=False)
        req = await strict.request_approval("file_read", {"path": "."}, "safe")
        result = await strict.approve(req.id, "admin")
        assert result is True
        assert req.status == ApprovalStatus.APPROVED


class TestUniqueIdGeneration:
    @pytest.mark.asyncio
    async def test_each_request_gets_unique_id(self, mgr: ApprovalManager):
        r1 = await mgr.request_approval("bash", {"command": "a"}, "dangerous")
        r2 = await mgr.request_approval("bash", {"command": "b"}, "dangerous")
        assert r1.id != r2.id

    @pytest.mark.asyncio
    async def test_request_id_length(self, mgr: ApprovalManager):
        req = await mgr.request_approval("bash", {"command": "ls"}, "dangerous")
        assert len(req.id) == 16
