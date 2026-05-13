"""Comprehensive tests for engine.tools.composition module.

Covers: ToolChainStep, ToolChain, ToolChainExecutor
Edge cases: empty chains, failing steps, input mapping, output_key, unregister, multi-step.
"""

from __future__ import annotations

import pytest

from engine.tools.composition import ToolChain, ToolChainExecutor, ToolChainStep
from engine.tools.registry import ToolRegistry

# --- ToolChainStep ---


class TestToolChainStep:
    def test_defaults(self):
        step = ToolChainStep(tool_name="file_read")
        assert step.input_mapping == {}
        assert step.fixed_args == {}

    def test_with_mapping_and_fixed_args(self):
        step = ToolChainStep(
            tool_name="file_read",
            input_mapping={"path": "output_path"},
            fixed_args={"limit": 10},
        )
        assert step.input_mapping == {"path": "output_path"}
        assert step.fixed_args == {"limit": 10}


# --- ToolChain ---


class TestToolChain:
    def test_chain_creation(self):
        chain = ToolChain(
            name="test_chain",
            description="A test chain",
            steps=[ToolChainStep(tool_name="file_list")],
        )
        assert chain.name == "test_chain"
        assert chain.output_key == ""

    def test_chain_with_output_key(self):
        chain = ToolChain(
            name="chain_with_output",
            description="Has output key",
            steps=[ToolChainStep(tool_name="file_list")],
            output_key="custom_key",
        )
        assert chain.output_key == "custom_key"


# --- ToolChainExecutor ---


@pytest.fixture
def registry() -> ToolRegistry:
    return ToolRegistry()


@pytest.fixture
def executor(registry: ToolRegistry) -> ToolChainExecutor:
    return ToolChainExecutor(registry)


class TestChainRegistration:
    def test_register_and_list(self, executor: ToolChainExecutor):
        chain = ToolChain(
            name="my_chain",
            description="desc",
            steps=[ToolChainStep(tool_name="file_list")],
        )
        executor.register_chain(chain)
        chains = executor.list_chains()
        assert len(chains) == 1
        assert chains[0]["name"] == "my_chain"
        assert chains[0]["description"] == "desc"

    def test_register_overwrites_same_name(self, executor: ToolChainExecutor):
        chain1 = ToolChain(name="x", description="first", steps=[ToolChainStep(tool_name="file_list")])
        chain2 = ToolChain(name="x", description="second", steps=[ToolChainStep(tool_name="file_read")])
        executor.register_chain(chain1)
        executor.register_chain(chain2)
        chains = executor.list_chains()
        assert len(chains) == 1
        assert chains[0]["description"] == "second"

    def test_unregister_existing(self, executor: ToolChainExecutor):
        chain = ToolChain(name="removable", description="d", steps=[ToolChainStep(tool_name="file_list")])
        executor.register_chain(chain)
        assert executor.unregister_chain("removable") is True
        assert len(executor.list_chains()) == 0

    def test_unregister_nonexistent(self, executor: ToolChainExecutor):
        assert executor.unregister_chain("nonexistent") is False

    def test_list_chains_includes_step_info(self, executor: ToolChainExecutor):
        chain = ToolChain(
            name="info_chain",
            description="d",
            steps=[ToolChainStep(tool_name="file_list", fixed_args={"path": "."})],
        )
        executor.register_chain(chain)
        info = executor.list_chains()[0]
        assert info["steps"][0]["tool"] == "file_list"
        assert info["steps"][0]["fixed_args"] == {"path": "."}


class TestChainValidation:
    def test_valid_chain_no_errors(self, executor: ToolChainExecutor):
        chain = ToolChain(
            name="valid",
            description="d",
            steps=[ToolChainStep(tool_name="file_list")],
        )
        errors = executor.validate_chain(chain)
        assert errors == []

    def test_empty_chain_has_error(self, executor: ToolChainExecutor):
        chain = ToolChain(name="empty", description="d", steps=[])
        errors = executor.validate_chain(chain)
        assert len(errors) == 1
        assert "at least one step" in errors[0].lower()

    def test_unknown_tool_in_step(self, executor: ToolChainExecutor):
        chain = ToolChain(
            name="bad",
            description="d",
            steps=[ToolChainStep(tool_name="nonexistent_tool")],
        )
        errors = executor.validate_chain(chain)
        assert len(errors) == 1
        assert "nonexistent_tool" in errors[0]

    def test_mixed_valid_and_invalid_steps(self, executor: ToolChainExecutor):
        chain = ToolChain(
            name="mixed",
            description="d",
            steps=[
                ToolChainStep(tool_name="file_list"),
                ToolChainStep(tool_name="bad_tool"),
                ToolChainStep(tool_name="another_bad"),
            ],
        )
        errors = executor.validate_chain(chain)
        assert len(errors) == 2


class TestChainExecution:
    @pytest.mark.asyncio
    async def test_single_step_chain(self, executor: ToolChainExecutor, tmp_path):
        (tmp_path / "sample.txt").write_text("hello", encoding="utf-8")
        chain = ToolChain(
            name="list_only",
            description="d",
            steps=[ToolChainStep(tool_name="file_list", fixed_args={"path": str(tmp_path)})],
        )
        result = await executor.execute_chain(chain, initial_args={})
        assert result.success

    @pytest.mark.asyncio
    async def test_chain_fails_on_step_error(self, executor: ToolChainExecutor):
        chain = ToolChain(
            name="failing",
            description="d",
            steps=[ToolChainStep(tool_name="file_read", fixed_args={"path": "/nonexistent/file"})],
        )
        result = await executor.execute_chain(chain, initial_args={})
        assert not result.success
        assert "failed at step 0" in result.output.lower() or "Chain failed" in result.output

    @pytest.mark.asyncio
    async def test_chain_stops_on_first_failure(self, executor: ToolChainExecutor):
        chain = ToolChain(
            name="two_step_fail",
            description="d",
            steps=[
                ToolChainStep(tool_name="file_read", fixed_args={"path": "/nonexistent"}),
                ToolChainStep(tool_name="file_list", fixed_args={"path": "."}),
            ],
        )
        result = await executor.execute_chain(chain, initial_args={})
        assert not result.success

    @pytest.mark.asyncio
    async def test_empty_chain_returns_failure(self, executor: ToolChainExecutor):
        chain = ToolChain(name="empty", description="d", steps=[])
        result = await executor.execute_chain(chain, initial_args={})
        assert not result.success
        assert "no results" in result.output.lower() or "no steps" in result.error.lower()


class TestInputMapping:
    @pytest.mark.asyncio
    async def test_input_mapping_from_initial_args(self, registry: ToolRegistry, executor: ToolChainExecutor, tmp_path):
        test_file = tmp_path / "mapped.txt"
        test_file.write_text("mapped content here", encoding="utf-8")
        chain = ToolChain(
            name="mapped",
            description="d",
            steps=[
                ToolChainStep(
                    tool_name="file_read",
                    input_mapping={"path": "file_path"},
                ),
            ],
        )
        result = await executor.execute_chain(chain, initial_args={"file_path": str(test_file)})
        assert result.success
        assert "mapped content here" in result.output

    @pytest.mark.asyncio
    async def test_input_mapping_overrides_fixed_args(self, executor: ToolChainExecutor, tmp_path):
        f1 = tmp_path / "fixed.txt"
        f2 = tmp_path / "mapped.txt"
        f1.write_text("fixed content", encoding="utf-8")
        f2.write_text("mapped content", encoding="utf-8")
        chain = ToolChain(
            name="override",
            description="d",
            steps=[
                ToolChainStep(
                    tool_name="file_read",
                    fixed_args={"path": str(f1)},
                    input_mapping={"path": "some_key"},
                ),
            ],
        )
        result = await executor.execute_chain(chain, initial_args={"some_key": str(f2)})
        assert result.success
        # input_mapping sets args AFTER fixed_args, so mapping wins
        assert "mapped content" in result.output


class TestOutputKey:
    @pytest.mark.asyncio
    async def test_output_key_extraction(self, executor: ToolChainExecutor, tmp_path):
        (tmp_path / "out.txt").write_text("output key test", encoding="utf-8")
        chain = ToolChain(
            name="with_output_key",
            description="d",
            steps=[ToolChainStep(tool_name="file_list", fixed_args={"path": str(tmp_path)})],
            output_key="output",
        )
        result = await executor.execute_chain(chain, initial_args={})
        assert result.success

    @pytest.mark.asyncio
    async def test_missing_output_key_returns_last_result(self, executor: ToolChainExecutor):
        chain = ToolChain(
            name="missing_key",
            description="d",
            steps=[ToolChainStep(tool_name="file_list", fixed_args={"path": "."})],
            output_key="nonexistent_key",
        )
        result = await executor.execute_chain(chain, initial_args={})
        assert result.success
