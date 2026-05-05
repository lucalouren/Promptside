import type { AdapterRunArgs, ModelAdapter, RunResult } from "../types/index.js";

export class GoogleAdapter implements ModelAdapter {
  readonly provider = "google" as const;

  async run(_args: AdapterRunArgs): Promise<RunResult> {
    throw new Error("GoogleAdapter.run not implemented (Step 2)");
  }
}
