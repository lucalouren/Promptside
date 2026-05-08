import OpenAI from "openai";
import type {
  AdapterRunArgs,
  ModelAdapter,
  ProviderId,
  RunResult,
  Usage,
} from "../types/index.js";
import { computeCostUsd } from "../pricing.js";
import { friendlyError } from "./index.js";

type ApiMode = "responses" | "chat";

export class OpenAIAdapter implements ModelAdapter {
  readonly provider: ProviderId;
  private readonly client: OpenAI;
  private readonly apiMode: ApiMode;
  private readonly modelRemap?: (model: string) => string;

  constructor(opts?: {
    provider?: ProviderId;
    apiKey?: string;
    baseURL?: string;
    apiMode?: ApiMode;
    modelRemap?: (model: string) => string;
  }) {
    this.provider = opts?.provider ?? "openai";
    this.apiMode = opts?.apiMode ?? "responses";
    this.modelRemap = opts?.modelRemap;
    this.client = new OpenAI({
      apiKey: opts?.apiKey ?? process.env.OPENAI_API_KEY,
      ...(opts?.baseURL && { baseURL: opts.baseURL }),
    });
  }

  async run(args: AdapterRunArgs): Promise<RunResult> {
    if (this.apiMode === "chat") {
      return this.runChat(args);
    }
    return this.runResponses(args);
  }

  private async runResponses(args: AdapterRunArgs): Promise<RunResult> {
    const { prompt, messages, spec, system } = args;
    const start = performance.now();

    const isReasoningModel = /^gpt-5/.test(spec.model) || /^o\d/.test(spec.model);
    const acceptsTemperature = !isReasoningModel;

    const input = messages
      ? messages.map((m) => ({ role: m.role, content: m.content }))
      : prompt;

    try {
      const response = await this.client.responses.create({
        model: this.modelRemap ? this.modelRemap(spec.model) : spec.model,
        input,
        max_output_tokens: spec.maxTokens ?? 1024,
        ...(acceptsTemperature && spec.temperature !== undefined && { temperature: spec.temperature }),
        ...(spec.topP !== undefined && { top_p: spec.topP }),
        ...(system && { instructions: system }),
        ...(isReasoningModel && { reasoning: { effort: "low" as const } }),
      });

      const latencyMs = Math.round(performance.now() - start);
      const output =
        typeof response.output_text === "string" && response.output_text.length > 0
          ? response.output_text
          : extractResponsesOutput(response);

      const usage: Usage = {
        inputTokens: response.usage?.input_tokens ?? 0,
        outputTokens: response.usage?.output_tokens ?? 0,
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
        error: { message: friendlyError(err, this.provider) },
      };
    }
  }

  private async runChat(args: AdapterRunArgs): Promise<RunResult> {
    const { prompt, messages, spec, system } = args;
    const start = performance.now();

    const chatMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [];
    if (system) chatMessages.push({ role: "system", content: system });

    if (messages) {
      for (const m of messages) {
        chatMessages.push({ role: m.role, content: m.content });
      }
    } else {
      chatMessages.push({ role: "user", content: prompt });
    }

    try {
      const response = await this.client.chat.completions.create({
        model: this.modelRemap ? this.modelRemap(spec.model) : spec.model,
        messages: chatMessages,
        max_tokens: spec.maxTokens ?? 1024,
        ...(spec.temperature !== undefined && { temperature: spec.temperature }),
        ...(spec.topP !== undefined && { top_p: spec.topP }),
      });

      const latencyMs = Math.round(performance.now() - start);
      const output = response.choices?.[0]?.message?.content ?? "";

      const usage: Usage = {
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
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
        error: { message: friendlyError(err, this.provider) },
      };
    }
  }
}

function extractResponsesOutput(
  response: { output?: Array<{ type: string; content?: Array<{ type: string; text?: string }> }> },
): string {
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
