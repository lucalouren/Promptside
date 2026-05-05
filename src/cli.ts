import { Command, Option } from "commander";
import { parseModelString } from "./adapters/index.js";
import type { ModelSpec, RendererTarget } from "./types/index.js";

export interface CliInvocation {
  prompt: string;
  models: ModelSpec[];
  renderer: RendererTarget;
  output?: string;
  watch: boolean;
  promptFile?: string;
}

const VERSION = "0.1.0-alpha.0";

const DEFAULT_MODELS = [
  "anthropic:claude-opus-4-7",
  "openai:gpt-5",
  "google:gemini-2.5-pro",
];

export function buildProgram(): Command {
  const program = new Command();
  program
    .name("promptdiff")
    .description(
      "Run the same prompt across multiple LLMs and diff the results, side-by-side.",
    )
    .version(VERSION);

  program
    .argument("[prompt]", "Inline prompt string, or path to a .prompt.md file")
    .option(
      "-m, --models <list>",
      "Comma-separated model list (e.g. anthropic:claude-opus-4-7,openai:gpt-5)",
      DEFAULT_MODELS.join(","),
    )
    .addOption(
      new Option("-r, --renderer <target>", "Output renderer")
        .choices(["terminal", "html"])
        .default("terminal"),
    )
    .option("-o, --output <path>", "Write rendered output to a file")
    .option("-w, --watch", "Re-run when the prompt file changes", false)
    .action(async (promptArg: string | undefined, opts: RawCliOptions) => {
      const invocation = parseInvocation(promptArg, opts);
      await runOnce(invocation);
    });

  return program;
}

interface RawCliOptions {
  models: string;
  renderer: RendererTarget;
  output?: string;
  watch: boolean;
}

export function parseInvocation(
  promptArg: string | undefined,
  opts: RawCliOptions,
): CliInvocation {
  const models = opts.models
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(parseModelString);

  if (!promptArg) {
    throw new Error(
      "Missing prompt. Provide a string or a path to a .prompt.md file.",
    );
  }

  const isFile = promptArg.endsWith(".prompt.md") || promptArg.endsWith(".md");

  return {
    prompt: isFile ? "" : promptArg,
    promptFile: isFile ? promptArg : undefined,
    models,
    renderer: opts.renderer,
    output: opts.output,
    watch: Boolean(opts.watch),
  };
}

async function runOnce(invocation: CliInvocation): Promise<void> {
  // Step 1 scaffold: surface what was parsed so users know the wiring works.
  // The Runner + renderers land in Step 2 and Step 3.
  const summary = {
    promptPreview: invocation.promptFile ?? truncate(invocation.prompt, 80),
    models: invocation.models.map((m) => `${m.provider}:${m.model}`),
    renderer: invocation.renderer,
    output: invocation.output ?? "(stdout)",
    watch: invocation.watch,
  };
  process.stdout.write(
    `promptdiff scaffold ready — implementation lands in Step 2.\n` +
      JSON.stringify(summary, null, 2) +
      "\n",
  );
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export async function main(argv: string[] = process.argv): Promise<void> {
  const program = buildProgram();
  await program.parseAsync(argv);
}
