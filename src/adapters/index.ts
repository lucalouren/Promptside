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
