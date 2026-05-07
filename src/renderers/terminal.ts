import chalk from "chalk";
import Table from "cli-table3";
import type { RenderInput, Renderer, RunResult } from "../types/index.js";

const PROVIDER_COLOR = {
  anthropic: chalk.hex("#D97706"),
  openai: chalk.hex("#10A37F"),
  google: chalk.hex("#4285F4"),
} as const;

export class TerminalRenderer implements Renderer {
  readonly target = "terminal" as const;

  render(input: RenderInput): string {
    const { prompt, results, generatedAt } = input;
    const lines: string[] = [];

    lines.push(chalk.dim("─".repeat(termWidth())));
    lines.push(`${chalk.bold("promptside")} ${chalk.dim("· " + generatedAt.toISOString())}`);
    lines.push("");
    lines.push(chalk.dim("PROMPT"));
    lines.push(indent(truncate(prompt, 600), "  "));
    lines.push("");

    lines.push(renderSummary(results));
    lines.push("");
    lines.push(renderSideBySide(results));
    lines.push("");
    lines.push(renderTotals(results));
    lines.push(chalk.dim("─".repeat(termWidth())));

    return lines.join("\n");
  }
}

function renderSummary(results: RunResult[]): string {
  const table = new Table({
    head: [
      chalk.bold("model"),
      chalk.bold("tokens (in / out)"),
      chalk.bold("latency"),
      chalk.bold("cost"),
      chalk.bold("status"),
    ],
    style: { head: [], border: ["grey"] },
  });

  for (const r of results) {
    const color = PROVIDER_COLOR[r.spec.provider] ?? chalk.white;
    table.push([
      color(`${r.spec.provider}:${r.spec.model}`),
      r.error ? chalk.dim("—") : `${r.usage.inputTokens} / ${r.usage.outputTokens}`,
      r.error ? chalk.dim("—") : `${r.latencyMs} ms`,
      r.error ? chalk.dim("—") : formatCost(r.costUsd),
      r.error ? chalk.red("error") : chalk.green("ok"),
    ]);
  }

  return table.toString();
}

function renderSideBySide(results: RunResult[]): string {
  const width = termWidth();
  const cols = results.length;
  // 1 separator char per gap between columns + small padding.
  const gutter = 2;
  const colWidth = Math.max(20, Math.floor((width - (cols - 1) * gutter) / cols));

  const headers = results.map((r) => {
    const color = PROVIDER_COLOR[r.spec.provider] ?? chalk.white;
    return color.bold(padOrTrim(`${r.spec.provider}:${r.spec.model}`, colWidth));
  });

  const bodies = results.map((r) => {
    if (r.error) {
      return wrapToWidth(
        chalk.red(`[error] ${truncate(r.error.message, 240)}`),
        colWidth,
      );
    }
    if (r.output.length === 0) {
      return wrapToWidth(
        chalk.dim("(no output — model used all tokens on reasoning)"),
        colWidth,
      );
    }
    return wrapToWidth(r.output, colWidth);
  });

  const maxRows = Math.max(...bodies.map((b) => b.length), 1);
  const rows: string[] = [];
  rows.push(headers.join(" ".repeat(gutter)));
  rows.push(results.map(() => chalk.dim("─".repeat(colWidth))).join(" ".repeat(gutter)));
  for (let i = 0; i < maxRows; i++) {
    rows.push(
      bodies
        .map((body) => padOrTrim(body[i] ?? "", colWidth))
        .join(" ".repeat(gutter)),
    );
  }
  return rows.join("\n");
}

function renderTotals(results: RunResult[]): string {
  const totalCost = results.reduce((s, r) => s + (r.error ? 0 : r.costUsd), 0);
  const totalIn = results.reduce((s, r) => s + r.usage.inputTokens, 0);
  const totalOut = results.reduce((s, r) => s + r.usage.outputTokens, 0);
  const slowest = Math.max(0, ...results.map((r) => r.latencyMs));
  return chalk.dim(
    `total: ${totalIn} in / ${totalOut} out tokens · ${formatCost(totalCost)} · slowest ${slowest} ms`,
  );
}

function formatCost(usd: number): string {
  if (usd === 0) return "$0.0000";
  if (usd < 0.0001) return "<$0.0001";
  return `$${usd.toFixed(4)}`;
}

function termWidth(): number {
  const w = process.stdout.columns ?? 100;
  return Math.max(60, Math.min(w, 200));
}

function indent(text: string, prefix: string): string {
  return text
    .split("\n")
    .map((line) => prefix + line)
    .join("\n");
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function padOrTrim(text: string, width: number): string {
  // chalk wraps strings in ANSI codes; we need to measure visible length.
  const visible = stripAnsi(text);
  if (visible.length === width) return text;
  if (visible.length > width) {
    // Trim by visible chars while preserving codes is complex; v0.1: trim raw
    // (renderer only feeds in already-wrapped lines, so this is rarely hit).
    return text.slice(0, width);
  }
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
      // Try to break on whitespace within the window.
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
