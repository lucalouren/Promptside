import { GoogleGenAI } from "@google/genai";
import type {
  AdapterRunArgs,
  ModelAdapter,
  RunResult,
  Usage,
} from "../types/index.js";
import { computeCostUsd } from "../pricing.js";
import { friendlyError } from "./index.js";

export interface GoogleClientLike {
  models: {
    generateContent(params: {
      model: string;
      contents: string | Array<{ role: string; parts: Array<{ text: string }> }>;
      config?: {
        temperature?: number;
        topP?: number;
        maxOutputTokens?: number;
        systemInstruction?: string;
      };
    }): Promise<{
      text?: string;
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
      };
    }>;
  };
}

export class GoogleAdapter implements ModelAdapter {
  readonly provider = "google" as const;
  private readonly client: GoogleClientLike;

  constructor(client?: GoogleClientLike) {
    this.client =
      client ??
      (new GoogleGenAI({
        apiKey: process.env.GOOGLE_API_KEY,
      }) as unknown as GoogleClientLike);
  }

  async run(args: AdapterRunArgs): Promise<RunResult> {
    const { prompt, messages, spec, system } = args;
    const start = performance.now();

    try {
      const config: Record<string, unknown> = {
        maxOutputTokens: spec.maxTokens ?? 1024,
      };
      if (spec.temperature !== undefined) config.temperature = spec.temperature;
      if (spec.topP !== undefined) config.topP = spec.topP;
      if (system) config.systemInstruction = system;

      const contents = messages
        ? messages.map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
          }))
        : prompt;

      const response = await this.client.models.generateContent({
        model: spec.model,
        contents,
        config,
      });

      const latencyMs = Math.round(performance.now() - start);
      const output = extractOutputText(response);

      const usage: Usage = {
        inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
      };
      const costUsd = computeCostUsd(spec.provider, spec.model, usage);

      return { spec, output, usage, latencyMs, costUsd };
    } catch (err) {
      const latencyMs = Math.round(performance.now() - start);
      return {
        spec,
        output: "",
        usage: { inputTokens: 0, outputTokens: 0 },
        latencyMs,
        costUsd: 0,
        error: { message: friendlyError(err, "google") },
      };
    }
  }
}

function extractOutputText(response: {
  text?: string;
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}): string {
  if (typeof response.text === "string" && response.text.length > 0) {
    return response.text;
  }
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  return parts
    .map((p) => p.text ?? "")
    .filter(Boolean)
    .join("");
}
