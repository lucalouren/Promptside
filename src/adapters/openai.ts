import OpenAI from "openai";
import type {
  AdapterRunArgs,
  ModelAdapter,
  RunResult,
  Usage,
} from "../types/index.js";
import { computeCostUsd } from "../pricing.js";

export interface OpenAIClientLike {
  responses: {
    create(params: {
      model: string;
      input: string;
      max_output_tokens?: number;
      temperature?: number;
      top_p?: number;
      instructions?: string;
      reasoning?: { effort?: "minimal" | "low" | "medium" | "high" };
    }): Promise<{
      output_text?: string;
      output?: Array<{
        type: string;
        content?: Array<{ type: string; text?: string }>;
      }>;
      usage: { input_tokens: number; output_tokens: number };
    }>;
  };
}

export class OpenAIAdapter implements ModelAdapter {
  readonly provider = "openai" as const;
  private readonly client: OpenAIClientLike;

  constructor(client?: OpenAIClientLike) {
    this.client =
      client ??
      (new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      }) as unknown as OpenAIClientLike);
  }

  async run(args: AdapterRunArgs): Promise<RunResult> {
    const { prompt, spec, system } = args;
    const start = performance.now();

    // GPT-5 (and other reasoning-class models) only accept the default
    // temperature; passing a non-default value 400s. We omit it for v0.1.
    const isReasoningModel = /^gpt-5/.test(spec.model) || /^o\d/.test(spec.model);
    const acceptsTemperature = !isReasoningModel;

    try {
      const response = await this.client.responses.create({
        model: spec.model,
        input: prompt,
        max_output_tokens: spec.maxTokens ?? 1024,
        ...(acceptsTemperature && spec.temperature !== undefined && { temperature: spec.temperature }),
        ...(spec.topP !== undefined && { top_p: spec.topP }),
        ...(system && { instructions: system }),
        // Reasoning models default to effort="medium" which burns through
        // the entire max_output_tokens budget on internal reasoning,
        // leaving no room for the actual response. "low" gives us visible
        // output without huge token budgets.
        ...(isReasoningModel && { reasoning: { effort: "low" as const } }),
      });

      const latencyMs = Math.round(performance.now() - start);
      const output = extractOutputText(response);

      const usage: Usage = {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
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
        error: { message: err instanceof Error ? err.message : String(err) },
      };
    }
  }
}

function extractOutputText(
  response: { output_text?: string; output?: Array<{ type: string; content?: Array<{ type: string; text?: string }> }> },
): string {
  if (typeof response.output_text === "string" && response.output_text.length > 0) {
    return response.output_text;
  }
  if (!response.output) return "";
  const chunks: string[] = [];
  for (const item of response.output) {
    if (!item.content) continue;
    for (const block of item.content) {
      if (block.type === "output_text" && typeof block.text === "string") {
        chunks.push(block.text);
      }
    }
  }
  return chunks.join("");
}
