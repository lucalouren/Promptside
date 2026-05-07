import type { ModelAdapter, ModelSpec, ProviderId } from "../types/index.js";
import { AnthropicAdapter } from "./anthropic.js";
import { OpenAIAdapter } from "./openai.js";
import { GoogleAdapter } from "./google.js";

export { AnthropicAdapter, OpenAIAdapter, GoogleAdapter };

const registry: Record<ProviderId, () => ModelAdapter> = {
  anthropic: () => new AnthropicAdapter(),
  openai: () => new OpenAIAdapter(),
  google: () => new GoogleAdapter(),
};

export function getAdapter(provider: ProviderId): ModelAdapter {
  return registry[provider]();
}

const PROVIDER_ENV_VARS: Record<ProviderId, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  google: "GOOGLE_API_KEY",
};

/**
 * Walks the requested model list, collects every missing API key, and throws
 * a single multi-line error if any are missing. Throws BEFORE we hand the
 * undefined key to a provider SDK (which would otherwise surface its own
 * less-friendly message and only for the first failing provider).
 */
export function validateEnv(models: ModelSpec[]): void {
  const seen = new Set<ProviderId>();
  const missing: Array<{ envVar: string; example: string }> = [];
  for (const spec of models) {
    if (seen.has(spec.provider)) continue;
    seen.add(spec.provider);
    const envVar = PROVIDER_ENV_VARS[spec.provider];
    if (!process.env[envVar]) {
      missing.push({
        envVar,
        example: `${spec.provider}:${spec.model}`,
      });
    }
  }
  if (missing.length === 0) return;

  const lines = missing.map((m) => `  - ${m.envVar} (required for ${m.example})`);
  throw new Error(
    `missing API keys for the requested providers:\n${lines.join("\n")}\n\nSet them in your environment or in a .env file in the current directory.`,
  );
}

const PROVIDER_BY_PREFIX: ReadonlyArray<[RegExp, ProviderId]> = [
  [/^claude[-_]/i, "anthropic"],
  [/^gpt[-_]/i, "openai"],
  [/^o\d/i, "openai"],
  [/^gemini[-_]/i, "google"],
];

export function parseModelString(input: string): ModelSpec {
  const trimmed = input.trim();
  if (trimmed.includes(":")) {
    const [providerRaw, ...rest] = trimmed.split(":");
    const provider = providerRaw?.toLowerCase() as ProviderId;
    const model = rest.join(":");
    if (!isProvider(provider) || !model) {
      throw new Error(`Invalid model spec: "${input}"`);
    }
    return { provider, model };
  }

  for (const [pattern, provider] of PROVIDER_BY_PREFIX) {
    if (pattern.test(trimmed)) {
      return { provider, model: trimmed };
    }
  }

  throw new Error(
    `Cannot infer provider for "${input}". Use the form "provider:model", e.g. "anthropic:claude-opus-4-7".`,
  );
}

function isProvider(value: string): value is ProviderId {
  return value === "anthropic" || value === "openai" || value === "google";
}
