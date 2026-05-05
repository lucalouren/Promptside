import type { AdapterRunArgs, ModelAdapter, RunResult } from "../types/index.js";

export class AnthropicAdapter implements ModelAdapter {
  readonly provider = "anthropic" as const;

  async run(_args: AdapterRunArgs): Promise<RunResult> {
    throw new Error("AnthropicAdapter.run not implemented (Step 2)");
  }
}
