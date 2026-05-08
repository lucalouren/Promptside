import type { ProviderId, Usage } from "./types/index.js";

// Pricing snapshot — verified 2026-05-05 against live provider docs.
// Sources:
//   Anthropic: https://docs.claude.com/en/docs/about-claude/models/overview
//   OpenAI:    https://openai.com/api/pricing/  (GPT-5 base tier)
//   Google:    https://ai.google.dev/gemini-api/docs/pricing
// Prices are USD per 1M tokens. Cached reads, batch discounts, and extended
// thinking surcharges are intentionally out of scope for v0.1.
export interface PricingEntry {
  provider: ProviderId;
  model: string;
  inputPer1M: number;
  outputPer1M: number;
  // Optional tier breakpoint for providers that price by prompt length
  // (Gemini 2.5 Pro: ≤200k input tokens cheaper, >200k more expensive).
  longContext?: {
    inputTokenThreshold: number;
    inputPer1M: number;
    outputPer1M: number;
  };
  // Documented context / output window — informational, not used for cost.
  contextWindow?: number;
  maxOutputTokens?: number;
}

const PRICING: PricingEntry[] = [
  // ── Anthropic ──
  {
    provider: "anthropic",
    model: "claude-opus-4-7",
    inputPer1M: 5.0,
    outputPer1M: 25.0,
    contextWindow: 1_000_000,
    maxOutputTokens: 128_000,
  },
  {
    provider: "anthropic",
    model: "claude-sonnet-4-5",
    inputPer1M: 3.0,
    outputPer1M: 15.0,
    contextWindow: 200_000,
    maxOutputTokens: 16_384,
  },
  {
    provider: "anthropic",
    model: "claude-haiku-3-5",
    inputPer1M: 0.8,
    outputPer1M: 4.0,
    contextWindow: 200_000,
    maxOutputTokens: 8_192,
  },

  // ── OpenAI ──
  {
    provider: "openai",
    model: "gpt-5",
    inputPer1M: 1.25,
    outputPer1M: 10.0,
    contextWindow: 400_000,
    maxOutputTokens: 128_000,
  },
  {
    provider: "openai",
    model: "gpt-4.1",
    inputPer1M: 2.0,
    outputPer1M: 8.0,
    contextWindow: 1_000_000,
    maxOutputTokens: 32_768,
  },
  {
    provider: "openai",
    model: "gpt-4.1-mini",
    inputPer1M: 0.4,
    outputPer1M: 1.6,
    contextWindow: 1_000_000,
    maxOutputTokens: 32_768,
  },
  {
    provider: "openai",
    model: "gpt-4.1-nano",
    inputPer1M: 0.1,
    outputPer1M: 0.4,
    contextWindow: 1_000_000,
    maxOutputTokens: 32_768,
  },

  // ── Google ──
  {
    provider: "google",
    model: "gemini-2.5-pro",
    inputPer1M: 1.25,
    outputPer1M: 10.0,
    longContext: {
      inputTokenThreshold: 200_000,
      inputPer1M: 2.5,
      outputPer1M: 15.0,
    },
    contextWindow: 1_000_000,
    maxOutputTokens: 65_536,
  },
  {
    provider: "google",
    model: "gemini-2.5-flash",
    inputPer1M: 0.3,
    outputPer1M: 2.5,
    contextWindow: 1_000_000,
  },

  // ── xAI ──
  {
    provider: "xai",
    model: "grok-3",
    inputPer1M: 3.0,
    outputPer1M: 15.0,
    contextWindow: 131_072,
  },
  {
    provider: "xai",
    model: "grok-3-mini",
    inputPer1M: 0.3,
    outputPer1M: 0.5,
    contextWindow: 131_072,
  },

  // ── DeepSeek ──
  {
    provider: "deepseek",
    model: "deepseek-r1",
    inputPer1M: 0.55,
    outputPer1M: 2.19,
    contextWindow: 64_000,
  },
  {
    provider: "deepseek",
    model: "deepseek-v3",
    inputPer1M: 0.27,
    outputPer1M: 1.10,
    contextWindow: 64_000,
  },

  // ── Kimi (Moonshot) ──
  {
    provider: "kimi",
    model: "kimi-k2",
    inputPer1M: 0.6,
    outputPer1M: 2.4,
    contextWindow: 128_000,
  },
];

export const PRICING_SNAPSHOT_DATE = "2026-05-08";

export function getPricing(
  provider: ProviderId,
  model: string,
): PricingEntry | undefined {
  return PRICING.find((p) => p.provider === provider && p.model === model);
}

export function computeCostUsd(
  provider: ProviderId,
  model: string,
  usage: Usage,
): number {
  const entry = getPricing(provider, model);
  if (!entry) return 0;

  const useLongTier =
    entry.longContext !== undefined &&
    usage.inputTokens > entry.longContext.inputTokenThreshold;

  const inputRate = useLongTier
    ? entry.longContext!.inputPer1M
    : entry.inputPer1M;
  const outputRate = useLongTier
    ? entry.longContext!.outputPer1M
    : entry.outputPer1M;

  return (
    (usage.inputTokens * inputRate) / 1_000_000 +
    (usage.outputTokens * outputRate) / 1_000_000
  );
}
