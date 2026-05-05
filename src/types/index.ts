export type ProviderId = "anthropic" | "openai" | "google";

export interface ModelSpec {
  provider: ProviderId;
  model: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
}

export interface RunResult {
  spec: ModelSpec;
  output: string;
  usage: Usage;
  latencyMs: number;
  costUsd: number;
  error?: { message: string };
}

export interface AdapterRunArgs {
  prompt: string;
  spec: ModelSpec;
  signal?: AbortSignal;
}

export interface ModelAdapter {
  readonly provider: ProviderId;
  run(args: AdapterRunArgs): Promise<RunResult>;
}

export interface RunnerOptions {
  prompt: string;
  models: ModelSpec[];
  concurrency?: number;
  signal?: AbortSignal;
}

export type RendererTarget = "terminal" | "html";

export interface RenderInput {
  prompt: string;
  results: RunResult[];
  generatedAt: Date;
}

export interface Renderer {
  readonly target: RendererTarget;
  render(input: RenderInput): Promise<string> | string;
}
