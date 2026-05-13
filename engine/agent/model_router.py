"""Model routing — select optimal model based on task complexity."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ModelTier:
    provider: str
    model: str
    context_window: int
    max_output_tokens: int
    cost_per_1k_input: float
    cost_per_1k_output: float


MODEL_TIERS: dict[str, ModelTier] = {
    "light": ModelTier(
        provider="openai",
        model="gpt-4o-mini",
        context_window=128000,
        max_output_tokens=4096,
        cost_per_1k_input=0.00015,
        cost_per_1k_output=0.0006,
    ),
    "standard": ModelTier(
        provider="openai",
        model="gpt-4o",
        context_window=128000,
        max_output_tokens=4096,
        cost_per_1k_input=0.0025,
        cost_per_1k_output=0.01,
    ),
    "heavy": ModelTier(
        provider="anthropic",
        model="claude-sonnet-4-6",
        context_window=200000,
        max_output_tokens=8192,
        cost_per_1k_input=0.003,
        cost_per_1k_output=0.015,
    ),
}

COMPLEXITY_KEYWORDS = {
    "heavy": {
        "architect", "design", "refactor", "migrate", "debug complex",
        "analyze", "security audit", "performance", "optimize",
        "multi-agent", "orchestrate", "decompose",
    },
    "light": {
        "summarize", "translate", "format", "list", "count",
        "simple", "quick", "what is", "define", "explain briefly",
        "yes or no", "true or false",
    },
}

DEFAULT_TIER = "standard"


def classify_complexity(message: str) -> str:
    lower = message.lower()

    for keyword in COMPLEXITY_KEYWORDS["heavy"]:
        if keyword in lower:
            return "heavy"

    light_score = sum(1 for kw in COMPLEXITY_KEYWORDS["light"] if kw in lower)
    if light_score >= 2 or (light_score >= 1 and len(message) < 100):
        return "light"

    if len(message) > 2000:
        return "heavy"

    if len(message) > 500:
        return "standard"

    return DEFAULT_TIER


def route_model(message: str, override_tier: str | None = None) -> ModelTier:
    tier_name = override_tier or classify_complexity(message)
    return MODEL_TIERS.get(tier_name, MODEL_TIERS[DEFAULT_TIER])
