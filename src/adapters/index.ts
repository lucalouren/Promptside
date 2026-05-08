import type { ModelAdapter, ModelSpec, ProviderId } from "../types/index.js";
import { AnthropicAdapter } from "./anthropic.js";
import { OpenAIAdapter } from "./openai.js";
import { GoogleAdapter } from "./google.js";

export { AnthropicAdapter, OpenAIAdapter, GoogleAdapter };

const OPENAI_COMPAT_PROVIDERS: Record<string, { envVar: string; baseURL: string }> = {
  xai: { envVar: "XAI_API_KEY", baseURL: "https://api.x.ai/v1" },
  deepseek: { envVar: "DEEPSEEK_API_KEY", baseURL: "https://api.deepseek.com" },
  kimi: { envVar: "KIMI_API_KEY", baseURL: "https://api.moonshot.cn/v1" },
};

// Model name mapping for OpenRouter (their API expects provider-prefixed names).
const OPENROUTER_MODEL_MAP: Record<string, Record<string, string>> = {
  anthropic: {
    "claude-opus-4-7": "anthropic/claude-opus-4-7",
    "claude-sonnet-4-5": "anthropic/claude-sonnet-4-5",
    "claude-haiku-3-5": "anthropic/claude-3-5-haiku",
  },
  openai: {
    "gpt-5": "openai/gpt-5",
    "gpt-4.1": "openai/gpt-4.1",
    "gpt-4.1-mini": "openai/gpt-4.1-mini",
    "gpt-4.1-nano": "openai/gpt-4.1-nano",
  },
  google: {
    "gemini-2.5-flash": "google/gemini-2.5-flash-preview",
    "gemini-2.5-pro": "google/gemini-2.5-pro-preview",
  },
  xai: {
    "grok-3": "x-ai/grok-3",
    "grok-3-mini": "x-ai/grok-3-mini",
  },
  deepseek: {
    "deepseek-r1": "deepseek/deepseek-r1",
    "deepseek-v3": "deepseek/deepseek-chat",
  },
  kimi: {
    "kimi-k2": "moonshotai/kimi-k2",
  },
};

function openRouterModel(provider: string, model: string): string {
  return OPENROUTER_MODEL_MAP[provider]?.[model] ?? `${provider}/${model}`;
}

function makeOpenRouterAdapter(provider: ProviderId, model: string): OpenAIAdapter {
  return new OpenAIAdapter({
    provider,
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: "https://openrouter.ai/api/v1",
    apiMode: "chat",
    modelRemap: (m) => openRouterModel(provider, m),
  });
}

export function getAdapter(provider: ProviderId, model?: string): ModelAdapter {
  // Direct provider keys take priority.
  switch (provider) {
    case "anthropic":
      if (process.env.ANTHROPIC_API_KEY) return new AnthropicAdapter();
      break;
    case "openai":
      if (process.env.OPENAI_API_KEY) return new OpenAIAdapter();
      break;
    case "google":
      if (process.env.GOOGLE_API_KEY) return new GoogleAdapter();
      break;
    default: {
      // xai, deepseek, kimi — OpenAI-compatible providers.
      const compat = OPENAI_COMPAT_PROVIDERS[provider];
      if (compat && process.env[compat.envVar]) {
        return new OpenAIAdapter({
          provider,
          apiKey: process.env[compat.envVar],
          baseURL: compat.baseURL,
          apiMode: "chat",
        });
      }
      break;
    }
  }

  // Fallback: OpenRouter (one key for all providers).
  if (process.env.OPENROUTER_API_KEY) {
    return makeOpenRouterAdapter(provider, model ?? "");
  }

  // No key found — return the native adapter anyway; it will fail with a
  // friendly auth error from the SDK.
  switch (provider) {
    case "anthropic": return new AnthropicAdapter();
    case "openai": return new OpenAIAdapter();
    case "google": return new GoogleAdapter();
    default: {
      const compat = OPENAI_COMPAT_PROVIDERS[provider];
      if (compat) {
        return new OpenAIAdapter({ provider, baseURL: compat.baseURL, apiMode: "chat" });
      }
      throw new Error(`Unknown provider: ${provider}`);
    }
  }
}

const PROVIDER_ENV_VARS: Record<ProviderId, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  google: "GOOGLE_API_KEY",
  xai: "XAI_API_KEY",
  deepseek: "DEEPSEEK_API_KEY",
  kimi: "KIMI_API_KEY",
};

/**
 * Walks the requested model list, collects every missing API key, and throws
 * a single multi-line error if any are missing. Throws BEFORE we hand the
 * undefined key to a provider SDK (which would otherwise surface its own
 * less-friendly message and only for the first failing provider).
 */
export function validateEnv(models: ModelSpec[]): void {
  const hasOpenRouter = Boolean(process.env.OPENROUTER_API_KEY);
  const seen = new Set<ProviderId>();
  const missing: Array<{ envVar: string; example: string }> = [];
  for (const spec of models) {
    if (seen.has(spec.provider)) continue;
    seen.add(spec.provider);
    const envVar = PROVIDER_ENV_VARS[spec.provider];
    if (!process.env[envVar] && !hasOpenRouter) {
      missing.push({
        envVar,
        example: `${spec.provider}:${spec.model}`,
      });
    }
  }
  if (missing.length === 0) return;

  const lines = missing.map((m) => `  - ${m.envVar} (required for ${m.example})`);
  throw new Error(
    `missing API keys for the requested providers:\n${lines.join("\n")}\n\nSet them in your environment or in a .env file.\nTip: set OPENROUTER_API_KEY to use one key for all providers (https://openrouter.ai).`,
  );
}

/**
 * Turns raw SDK errors into short, human-friendly messages.
 * Falls back to the original message if no pattern matches.
 */
export function friendlyError(err: unknown, provider: ProviderId): string {
  const raw = err instanceof Error ? err.message : String(err);

  // Auth errors — all three providers return 401 or "invalid key" variants.
  if (/401|invalid.*api.?key|authentication_error|incorrect api key/i.test(raw)) {
    const envVar = PROVIDER_ENV_VARS[provider];
    return `Invalid API key. Check that ${envVar} is set correctly.`;
  }

  // Rate limits / quota
  if (/429|rate.?limit|quota|too many requests/i.test(raw)) {
    return `Rate limited by ${provider}. Wait a moment and try again, or check your plan's quota.`;
  }

  // Server errors
  if (/50[0-9]|server error|overloaded|high demand/i.test(raw)) {
    return `${provider} returned a server error. Try again in a few seconds.`;
  }

  return raw;
}

const PROVIDER_BY_PREFIX: ReadonlyArray<[RegExp, ProviderId]> = [
  [/^claude[-_]/i, "anthropic"],
  [/^gpt[-_]/i, "openai"],
  [/^gpt-\d/i, "openai"],
  [/^o\d/i, "openai"],
  [/^gemini[-_]/i, "google"],
  [/^grok[-_]/i, "xai"],
  [/^deepseek[-_]/i, "deepseek"],
  [/^kimi[-_]/i, "kimi"],
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

const ALL_PROVIDERS = new Set<string>(["anthropic", "openai", "google", "xai", "deepseek", "kimi"]);

function isProvider(value: string): value is ProviderId {
  return ALL_PROVIDERS.has(value);
}
