import { getAdapter } from "../adapters/index.js";
import type { ModelAdapter, RunResult, RunnerOptions } from "../types/index.js";

export class Runner {
  private readonly adapterFactory: (provider: string) => ModelAdapter;

  constructor(adapterFactory?: (provider: string) => ModelAdapter) {
    this.adapterFactory =
      adapterFactory ?? ((p) => getAdapter(p as "anthropic" | "openai" | "google"));
  }

  async run(options: RunnerOptions): Promise<RunResult[]> {
    const { prompt, models, signal } = options;
    return Promise.all(
      models.map((spec) => {
        const adapter = this.adapterFactory(spec.provider);
        return adapter.run({ prompt, spec, signal });
      }),
    );
  }
}
