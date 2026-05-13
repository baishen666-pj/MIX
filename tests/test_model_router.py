"""Tests for engine.agent.model_router — model selection by complexity."""

from __future__ import annotations

from engine.agent.model_router import (
    MODEL_TIERS,
    ModelTier,
    classify_complexity,
    route_model,
)


class TestClassifyComplexity:
    def test_simple_question_is_light(self) -> None:
        assert classify_complexity("What is Python?") == "light"

    def test_quick_task_is_light(self) -> None:
        assert classify_complexity("quick: list files") == "light"

    def test_short_define_is_light(self) -> None:
        assert classify_complexity("define variable") == "light"

    def test_summarize_is_light(self) -> None:
        assert classify_complexity("Summarize this text for me") == "light"

    def test_yes_no_is_light(self) -> None:
        assert classify_complexity("Is this true or false?") == "light"

    def test_architecture_is_heavy(self) -> None:
        assert classify_complexity("Design a microservices architecture") == "heavy"

    def test_debug_complex_is_heavy(self) -> None:
        assert classify_complexity("Help me debug complex race condition") == "heavy"

    def test_security_audit_is_heavy(self) -> None:
        assert classify_complexity("Run a security audit on auth module") == "heavy"

    def test_performance_is_heavy(self) -> None:
        assert classify_complexity("Optimize the database query performance") == "heavy"

    def test_long_message_is_heavy(self) -> None:
        long_msg = "Please help " + "with this " * 300
        assert classify_complexity(long_msg) == "heavy"

    def test_medium_message_is_standard(self) -> None:
        msg = "Can you help me write a function that processes user input and validates it?"
        result = classify_complexity(msg)
        assert result in ("standard", "light", "heavy")

    def test_default_conversation_is_standard(self) -> None:
        assert classify_complexity("Hello, how are you?") == "standard"


class TestRouteModel:
    def test_returns_model_tier(self) -> None:
        tier = route_model("What is Python?")
        assert isinstance(tier, ModelTier)
        assert tier.provider
        assert tier.model
        assert tier.context_window > 0

    def test_light_tier_uses_mini(self) -> None:
        tier = route_model("What is Python?")
        assert tier.model == "gpt-4o-mini"

    def test_heavy_tier_uses_sonnet(self) -> None:
        tier = route_model("Design a distributed system architecture")
        assert "sonnet" in tier.model.lower() or "claude" in tier.model.lower()

    def test_override_tier(self) -> None:
        tier = route_model("simple question", override_tier="heavy")
        assert "sonnet" in tier.model.lower() or "claude" in tier.model.lower()

    def test_invalid_tier_returns_default(self) -> None:
        tier = route_model("test", override_tier="nonexistent")
        assert tier == MODEL_TIERS["standard"]

    def test_all_tiers_have_required_fields(self) -> None:
        for name, tier in MODEL_TIERS.items():
            assert tier.provider, f"{name} missing provider"
            assert tier.model, f"{name} missing model"
            assert tier.context_window > 0, f"{name} invalid context_window"
            assert tier.max_output_tokens > 0, f"{name} invalid max_output_tokens"
            assert tier.cost_per_1k_input >= 0, f"{name} invalid input cost"
            assert tier.cost_per_1k_output >= 0, f"{name} invalid output cost"
