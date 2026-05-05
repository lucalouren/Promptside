import { readFile } from "node:fs/promises";
import matter from "gray-matter";
import { parseModelString } from "./adapters/index.js";
import type { ModelSpec } from "./types/index.js";

export interface PromptFile {
  prompt: string;
  models: ModelSpec[];
  temperature?: number;
  maxTokens?: number;
  system?: string;
  source: string;
}

interface RawFrontmatter {
  models?: unknown;
  temperature?: unknown;
  max_tokens?: unknown;
  maxTokens?: unknown;
  system?: unknown;
}

export async function loadPromptFile(path: string): Promise<PromptFile> {
  const raw = await readFile(path, "utf8");
  return parsePromptFile(raw, path);
}

export function parsePromptFile(raw: string, source: string): PromptFile {
  const parsed = matter(raw);
  const data = (parsed.data ?? {}) as RawFrontmatter;
  const body = parsed.content.trim();

  if (!body) {
    throw new Error(
      `Prompt file "${source}" has no body — put the prompt below the frontmatter.`,
    );
  }

  const modelsRaw = data.models;
  if (!Array.isArray(modelsRaw) || modelsRaw.length === 0) {
    throw new Error(
      `Prompt file "${source}" must declare a non-empty "models" list in frontmatter.`,
    );
  }

  const models: ModelSpec[] = modelsRaw.map((entry) => {
    if (typeof entry !== "string") {
      throw new Error(
        `Prompt file "${source}" has a non-string entry in "models": ${JSON.stringify(entry)}`,
      );
    }
    return parseModelString(entry);
  });

  const temperature = numberOrUndefined(data.temperature, "temperature", source);
  const maxTokens =
    numberOrUndefined(data.max_tokens, "max_tokens", source) ??
    numberOrUndefined(data.maxTokens, "maxTokens", source);
  const system = data.system === undefined ? undefined : String(data.system);

  // Apply file-level temperature / maxTokens to each spec unless the spec
  // (which here is just the model string) already overrides — at v0.1 the
  // model string carries no per-model overrides, so the file-level value wins.
  const merged = models.map<ModelSpec>((spec) => ({
    ...spec,
    ...(temperature !== undefined && { temperature }),
    ...(maxTokens !== undefined && { maxTokens }),
  }));

  return {
    prompt: body,
    models: merged,
    ...(temperature !== undefined && { temperature }),
    ...(maxTokens !== undefined && { maxTokens }),
    ...(system !== undefined && { system }),
    source,
  };
}

function numberOrUndefined(
  value: unknown,
  field: string,
  source: string,
): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  throw new Error(
    `Prompt file "${source}" field "${field}" must be a number, got ${JSON.stringify(value)}`,
  );
}
