import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import chalk from "chalk";
import type { Message, ModelSpec, RunResult } from "./types/index.js";
import { Runner } from "./runner/index.js";

const PROVIDER_COLOR: Record<string, (s: string) => string> = {
  anthropic: chalk.hex("#D97706"),
  openai: chalk.hex("#10A37F"),
  google: chalk.hex("#4285F4"),
  xai: chalk.hex("#FFFFFF"),
  deepseek: chalk.hex("#4D6BFE"),
  kimi: chalk.hex("#7C3AED"),
};

function colorFor(provider: string): (s: string) => string {
  return PROVIDER_COLOR[provider] ?? chalk.white;
}

export async function startRepl(models: ModelSpec[], system?: string): Promise<void> {
  const rl = readline.createInterface({ input, output, prompt: "" });

  const histories = new Map<string, Message[]>();
  for (const m of models) {
    histories.set(`${m.provider}:${m.model}`, []);
  }

  const runner = new Runner();

  // Header
  const w = Math.min(process.stdout.columns ?? 100, 200);
  process.stdout.write(chalk.dim("─".repeat(w)) + "\n");
  process.stdout.write(
    `${chalk.bold("promptside")} ${chalk.dim("interactive")} · ${models.map((m) => colorFor(m.provider)(`${m.provider}:${m.model}`)).join(chalk.dim(" · "))}\n`,
  );
  process.stdout.write(chalk.dim("type a prompt and press Enter · /help for commands · /quit to exit") + "\n");
  process.stdout.write(chalk.dim("supports: claude · gpt · gemini · grok · deepseek · kimi — use -m to pick models") + "\n");
  process.stdout.write(chalk.dim("─".repeat(w)) + "\n\n");

  const printHelp = () => {
    process.stdout.write(
      chalk.dim(
        [
          "  /models   — list active models",
          "  /clear    — reset conversation history",
          "  /help     — show this help",
          "  /quit     — exit",
          "",
        ].join("\n"),
      ) + "\n",
    );
  };

  // Main loop
  while (true) {
    let userInput: string;
    try {
      userInput = await rl.question(chalk.cyan("> "));
    } catch {
      // EOF / Ctrl+D
      break;
    }

    const trimmed = userInput.trim();
    if (!trimmed) continue;

    // Slash commands
    if (trimmed.startsWith("/")) {
      const cmd = trimmed.toLowerCase();
      if (cmd === "/quit" || cmd === "/exit" || cmd === "/q") {
        break;
      }
      if (cmd === "/help" || cmd === "/h") {
        printHelp();
        continue;
      }
      if (cmd === "/models" || cmd === "/m") {
        for (const m of models) {
          const key = `${m.provider}:${m.model}`;
          const msgCount = histories.get(key)?.length ?? 0;
          process.stdout.write(
            `  ${colorFor(m.provider)(key)} ${chalk.dim(`(${msgCount / 2} turns)`)}\n`,
          );
        }
        process.stdout.write("\n");
        continue;
      }
      if (cmd === "/clear" || cmd === "/c") {
        for (const [key] of histories) {
          histories.set(key, []);
        }
        process.stdout.write(chalk.dim("  conversation history cleared\n\n"));
        continue;
      }
      process.stdout.write(chalk.dim(`  unknown command: ${trimmed}\n\n`));
      continue;
    }

    // Append user message to all histories
    for (const [key, msgs] of histories) {
      msgs.push({ role: "user", content: trimmed });
    }

    // Run all models in parallel, each with its own history
    process.stdout.write(chalk.dim("  thinking…") + "\r");
    const results = await Promise.all(
      models.map(async (spec) => {
        const key = `${spec.provider}:${spec.model}`;
        const msgs = histories.get(key)!;
        const result = await runner.run({
          prompt: trimmed,
          messages: msgs,
          models: [spec],
          system,
        });
        return result[0]!;
      }),
    );

    // Clear "thinking…" line
    process.stdout.write(" ".repeat(w) + "\r");

    // Append assistant responses to histories
    for (let i = 0; i < results.length; i++) {
      const r = results[i]!;
      const key = `${r.spec.provider}:${r.spec.model}`;
      const msgs = histories.get(key)!;
      if (r.error) {
        // Remove the user message on error so history stays clean
        msgs.pop();
      } else {
        msgs.push({ role: "assistant", content: r.output });
      }
    }

    // Render side-by-side
    renderReplResults(results, w);
  }

  rl.close();
  process.stdout.write(chalk.dim("\ngoodbye\n"));
}

function renderReplResults(results: RunResult[], termWidth: number): void {
  const cols = results.length;
  const gutter = 2;
  const colWidth = Math.max(20, Math.floor((termWidth - (cols - 1) * gutter) / cols));

  // Headers
  const headers = results.map((r) => {
    const color = colorFor(r.spec.provider);
    const label = `${r.spec.model}`;
    return chalk.bold(color(padOrTrim(label, colWidth)));
  });
  process.stdout.write("\n" + headers.join(" ".repeat(gutter)) + "\n");
  process.stdout.write(
    results.map(() => chalk.dim("─".repeat(colWidth))).join(" ".repeat(gutter)) + "\n",
  );

  // Bodies
  const bodies = results.map((r) => {
    if (r.error) {
      return wrapToWidth(chalk.red(`[error] ${r.error.message}`), colWidth);
    }
    if (r.output.length === 0) {
      return [chalk.dim("(no output)")];
    }
    return wrapToWidth(r.output, colWidth);
  });

  const maxRows = Math.max(...bodies.map((b) => b.length), 1);
  for (let i = 0; i < maxRows; i++) {
    process.stdout.write(
      bodies
        .map((body) => padOrTrim(body[i] ?? "", colWidth))
        .join(" ".repeat(gutter)) + "\n",
    );
  }

  // Cost/latency line
  const totalCost = results.reduce((s, r) => s + r.costUsd, 0);
  const slowest = Math.max(0, ...results.map((r) => r.latencyMs));
  process.stdout.write(
    chalk.dim(
      `  ${formatCost(totalCost)} · ${(slowest / 1000).toFixed(1)}s`,
    ) + "\n\n",
  );
}

function formatCost(usd: number): string {
  if (usd === 0) return "$0.0000";
  if (usd < 0.0001) return "<$0.0001";
  return `$${usd.toFixed(4)}`;
}

function padOrTrim(text: string, width: number): string {
  const visible = stripAnsi(text);
  if (visible.length === width) return text;
  if (visible.length > width) return text.slice(0, width);
  return text + " ".repeat(width - visible.length);
}

function wrapToWidth(text: string, width: number): string[] {
  const out: string[] = [];
  for (const rawLine of text.split("\n")) {
    if (rawLine === "") {
      out.push("");
      continue;
    }
    let remaining = rawLine;
    while (stripAnsi(remaining).length > width) {
      const visible = stripAnsi(remaining).slice(0, width);
      const lastSpace = visible.lastIndexOf(" ");
      const cut = lastSpace > Math.floor(width * 0.5) ? lastSpace : width;
      out.push(remaining.slice(0, cut));
      remaining = remaining.slice(cut).replace(/^\s+/, "");
    }
    out.push(remaining);
  }
  return out;
}

const ANSI_RE = /\x1B\[[0-9;]*m/g;
function stripAnsi(text: string): string {
  return text.replace(ANSI_RE, "");
}
