import type { AdapterRunArgs, ModelAdapter, RunResult } from "../types/index.js";

export class OpenAIAdapter implements ModelAdapter {
  readonly provider = "openai" as const;

  async run(_args: AdapterRunArgs): Promise<RunResult> {
    throw new Error("OpenAIAdapter.run not implemented (Step 2)");
  }
}
