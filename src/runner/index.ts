import type { RunResult, RunnerOptions } from "../types/index.js";

export class Runner {
  async run(_options: RunnerOptions): Promise<RunResult[]> {
    throw new Error("Runner.run not implemented (Step 2)");
  }
}
