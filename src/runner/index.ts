import { getAdapter } from "../adapters/index.js";
import type { ModelAdapter, ProviderId, RunResult, RunnerOptions } from "../types/index.js";

export class Runner {
  private readonly adapterFactory: (provider: string, model?: string) => ModelAdapter;

  constructor(adapterFactory?: (provider: string, model?: string) => ModelAdapter) {
    this.adapterFactory =
      adapterFactory ?? ((p: string, m?: string) => getAdapter(p as ProviderId, m));
  }

  async run(options: RunnerOptions): Promise<RunResult[]> {
    const { prompt, messages, models, system, signal } = options;
    return Promise.all(
      models.map((spec) => {
        const adapter = this.adapterFactory(spec.provider, spec.model);
        return adapter.run({ prompt, messages, spec, system, signal });
      }),
    );
  }
}
