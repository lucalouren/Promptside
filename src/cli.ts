import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Command, Option } from "commander";
import chokidar from "chokidar";
import { parseModelString, validateEnv } from "./adapters/index.js";
import { Runner } from "./runner/index.js";
import { getRenderer } from "./renderers/index.js";
import { loadPromptFile } from "./promptFile.js";
import { startRepl } from "./repl.js";
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

const VERSION = "0.2.0";

const FULL_DEFAULTS = [
  { model: "anthropic:claude-sonnet-4-5", envVar: "ANTHROPIC_API_KEY" },
  { model: "openai:gpt-4.1", envVar: "OPENAI_API_KEY" },
  { model: "google:gemini-2.5-flash", envVar: "GOOGLE_API_KEY" },
  { model: "xai:grok-3-mini", envVar: "XAI_API_KEY" },
  { model: "deepseek:deepseek-v3", envVar: "DEEPSEEK_API_KEY" },
  { model: "kimi:kimi-k2", envVar: "KIMI_API_KEY" },
];

/**
 * Build default model list based on which API keys are available.
 * OpenRouter key counts as a wildcard — enables all defaults.
 */
function getDefaultModels(): string[] {
  const hasOpenRouter = Boolean(process.env.OPENROUTER_API_KEY);
  if (hasOpenRouter) {
    return FULL_DEFAULTS.map((d) => d.model);
  }
  const available = FULL_DEFAULTS.filter((d) => Boolean(process.env[d.envVar]));
  if (available.length > 0) {
    return available.map((d) => d.model);
  }
  // Nothing set — return the big 3 so validateEnv can give a helpful error.
  return ["anthropic:claude-sonnet-4-5", "openai:gpt-4.1", "google:gemini-2.5-flash"];
}

const DEFAULT_MODELS_STRING = "anthropic:claude-sonnet-4-5,openai:gpt-4.1,google:gemini-2.5-flash";

interface RawCliOptions {
  models: string;
  renderer: RendererTarget;
  output?: string;
  html?: string;
  watch: boolean;
}

export function buildProgram(): Command {
  const program = new Command();
  program
    .name("promptside")
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
      .option("--html <path>", "Write a self-contained HTML report to the given path")
      .option("-w, --watch", "Re-run when the prompt file changes", false);

  // Default command: inline prompt OR auto-detected .prompt.md path.
  sharedOptions(
    program
      .argument("[prompt]", "Inline prompt string, or path to a .prompt.md file")
      .action(async (promptArg: string | undefined, _opts: RawCliOptions, cmd: Command) => {
        if (!promptArg) {
          // No prompt — launch interactive REPL.
          const opts = cmd.optsWithGlobals() as RawCliOptions;
          const modelsExplicit = opts.models !== DEFAULT_MODELS_STRING;
          const modelStrings = modelsExplicit
            ? opts.models.split(",").map((s) => s.trim()).filter(Boolean)
            : getDefaultModels();
          const models = modelStrings.map(parseModelString);
          validateEnv(models);
          await startRepl(models);
          return;
        }
        const invocation = await parseInvocation(promptArg, cmd.optsWithGlobals() as RawCliOptions);
        await runOnce(invocation);
      }),
  );

  // Explicit subcommand: promptside run <file.prompt.md>
  sharedOptions(
    program
      .command("run <file>")
      .description("Run a .prompt.md file (frontmatter + body)")
      .action(async (file: string, _opts: RawCliOptions, cmd: Command) => {
        const opts = cmd.optsWithGlobals() as RawCliOptions;
        const invocation = await parseInvocation(file, opts);
        if (!invocation.promptFile) {
          throw new Error(`"${file}" is not a .prompt.md file.`);
        }
        await runOnce(invocation);
        if (invocation.watch) {
          await runWatch(invocation.promptFile, opts);
        }
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

  if (opts.html) {
    opts.renderer = "html" as RendererTarget;
    opts.output = opts.html;
  }

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
  validateEnv(invocation.models);
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

async function runWatch(filePath: string, opts: RawCliOptions): Promise<void> {
  const absPath = resolve(filePath);
  process.stdout.write(`\nwatching ${filePath} · press Ctrl+C to stop\n`);

  const watcher = chokidar.watch(absPath, {
    awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
  });

  let running = false;

  const onFileChange = async () => {
    if (running) return;
    running = true;
    try {
      console.clear();
      const ts = new Date().toLocaleTimeString();
      process.stdout.write(`↻ re-running… ${ts}\n\n`);
      const invocation = await parseInvocation(filePath, { ...opts });
      await runOnce(invocation);
      process.stdout.write(`\n${"─".repeat(60)}\nwatching ${filePath} · press Ctrl+C to stop\n`);
    } catch (err) {
      process.stderr.write(`\nerror: ${err instanceof Error ? err.message : err}\n`);
      process.stdout.write(`\nwatching ${filePath} · press Ctrl+C to stop\n`);
    } finally {
      running = false;
    }
  };

  watcher.on("change", onFileChange);
  watcher.on("unlink", () => {
    process.stdout.write("\nfile removed, exiting watch\n");
    watcher.close();
    process.exit(0);
  });

  process.on("SIGINT", () => {
    process.stdout.write("\nwatch stopped\n");
    watcher.close();
    process.exit(0);
  });

  return new Promise(() => {});
}

export async function main(argv: string[] = process.argv): Promise<void> {
  const program = buildProgram();
  await program.parseAsync(argv);
}
