import { writeFile } from "node:fs/promises";
import { Command, Option } from "commander";
import { parseModelString } from "./adapters/index.js";
import { Runner } from "./runner/index.js";
import { getRenderer } from "./renderers/index.js";
import { loadPromptFile } from "./promptFile.js";
import type { ModelSpec, RendererTarget } from "./types/index.js";

export interface CliInvocation {
  prompt: string;
  models: ModelSpec[];
  system?: string;
  renderer: RendererTarget;
  output?: string;
  watch: boolean;
  promptFile?: string;
  // True when the user explicitly overrode --models (so it should win over
  // any list from the .prompt.md frontmatter).
  modelsOverridden: boolean;
}

const VERSION = "0.1.0-alpha.0";

const DEFAULT_MODELS = [
  "anthropic:claude-opus-4-7",
  "openai:gpt-5",
  "google:gemini-2.5-flash",
];
const DEFAULT_MODELS_STRING = DEFAULT_MODELS.join(",");

interface RawCliOptions {
  models: string;
  renderer: RendererTarget;
  output?: string;
  watch: boolean;
}

export function buildProgram(): Command {
  const program = new Command();
  program
    .name("promptdiff")
    .description(
      "Run the same prompt across multiple LLMs and diff the results, side-by-side.",
    )
    .version(VERSION);

  const sharedOptions = (cmd: Command): Command =>
    cmd
      .option(
        "-m, --models <list>",
        "Comma-separated model list (e.g. anthropic:claude-opus-4-7,openai:gpt-5)",
        DEFAULT_MODELS_STRING,
      )
      .addOption(
        new Option("-r, --renderer <target>", "Output renderer")
          .choices(["terminal", "html"])
          .default("terminal"),
      )
      .option("-o, --output <path>", "Write rendered output to a file")
      .option("-w, --watch", "Re-run when the prompt file changes", false);

  // Default command: inline prompt OR auto-detected .prompt.md path.
  sharedOptions(
    program
      .argument("[prompt]", "Inline prompt string, or path to a .prompt.md file")
      .action(async (promptArg: string | undefined, opts: RawCliOptions) => {
        const invocation = await parseInvocation(promptArg, opts);
        await runOnce(invocation);
      }),
  );

  // Explicit subcommand: promptdiff run <file.prompt.md>
  sharedOptions(
    program
      .command("run <file>")
      .description("Run a .prompt.md file (frontmatter + body)")
      .action(async (file: string, opts: RawCliOptions) => {
        const invocation = await parseInvocation(file, opts);
        if (!invocation.promptFile) {
          throw new Error(`"${file}" is not a .prompt.md file.`);
        }
        await runOnce(invocation);
      }),
  );

  return program;
}

export async function parseInvocation(
  promptArg: string | undefined,
  opts: RawCliOptions,
): Promise<CliInvocation> {
  if (!promptArg) {
    throw new Error(
      "Missing prompt. Provide a string or a path to a .prompt.md file.",
    );
  }

  const isFile = promptArg.endsWith(".prompt.md") || promptArg.endsWith(".md");
  const modelsOverridden = opts.models !== DEFAULT_MODELS_STRING;

  if (isFile) {
    const file = await loadPromptFile(promptArg);
    const cliModels = opts.models
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map(parseModelString);

    return {
      prompt: file.prompt,
      // CLI --models wins when explicitly set; otherwise the file's list does.
      models: modelsOverridden ? cliModels : file.models,
      ...(file.system && { system: file.system }),
      renderer: opts.renderer,
      output: opts.output,
      watch: Boolean(opts.watch),
      promptFile: promptArg,
      modelsOverridden,
    };
  }

  const models = opts.models
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(parseModelString);

  return {
    prompt: promptArg,
    models,
    renderer: opts.renderer,
    output: opts.output,
    watch: Boolean(opts.watch),
    modelsOverridden,
  };
}

async function runOnce(invocation: CliInvocation): Promise<void> {
  const runner = new Runner();
  const results = await runner.run({
    prompt: invocation.prompt,
    models: invocation.models,
    ...(invocation.system && { system: invocation.system }),
  });

  const renderer = getRenderer(invocation.renderer);
  const rendered = await renderer.render({
    prompt: invocation.prompt,
    results,
    generatedAt: new Date(),
  });

  if (invocation.output) {
    await writeFile(invocation.output, rendered, "utf8");
    process.stdout.write(`wrote ${invocation.output}\n`);
  } else {
    process.stdout.write(rendered + "\n");
  }
}

export async function main(argv: string[] = process.argv): Promise<void> {
  const program = buildProgram();
  await program.parseAsync(argv);
}
