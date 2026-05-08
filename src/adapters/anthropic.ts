import Anthropic from "@anthropic-ai/sdk";
import type {
  AdapterRunArgs,
  ModelAdapter,
  RunResult,
  Usage,
} from "../types/index.js";
import { computeCostUsd } from "../pricing.js";
import { friendlyError } from "./index.js";

export interface AnthropicClientLike {
  messages: {
    create(params: {
      model: string;
      max_tokens: number;
      temperature?: number;
      top_p?: number;
      system?: string;
      messages: Array<{ role: "user" | "assistant"; content: string }>;
    }): Promise<{
      content: Array<{ type: string; text?: string }>;
      usage: { input_tokens: number; output_tokens: number };
    }>;
  };
}

export class AnthropicAdapter implements ModelAdapter {
  readonly provider = "anthropic" as const;
  private readonly client: AnthropicClientLike;

  constructor(client?: AnthropicClientLike) {
    this.client =
      client ??
      (new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      }) as unknown as AnthropicClientLike);
  }

  async run(args: AdapterRunArgs): Promise<RunResult> {
    const { prompt, messages, spec, system } = args;
    const start = performance.now();

    // Opus 4.7 rejects `temperature`. v0.1 ships only with that default;
    // when we add older models we can route per-model.
    const acceptsTemperature = !spec.model.startsWith("claude-opus-4-7");

    const apiMessages: Array<{ role: "user" | "assistant"; content: string }> = messages
      ? messages.map((m) => ({ role: m.role, content: m.content }))
      : [{ role: "user", content: prompt }];

    try {
      const response = await this.client.messages.create({
        model: spec.model,
        max_tokens: spec.maxTokens ?? 1024,
        ...(acceptsTemperature && spec.temperature !== undefined && { temperature: spec.temperature }),
        ...(spec.topP !== undefined && { top_p: spec.topP }),
        ...(system && { system }),
        messages: apiMessages,
      });

      const latencyMs = Math.round(performance.now() - start);
      const output = response.content
        .filter((block) => block.type === "text" && typeof block.text === "string")
        .map((block) => block.text!)
        .join("");

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
        error: { message: friendlyError(err, "anthropic") },
      };
    }
  }
}
