import dotenv from "dotenv";
dotenv.config({ override: true });
import { mkdir, writeFile, access } from "node:fs/promises";
import { Runner } from "../dist/runner/index.js";

const models = [
  { provider: "anthropic", model: "claude-opus-4-7", maxTokens: 1024 },
  { provider: "openai", model: "gpt-5", maxTokens: 1024 },
  { provider: "google", model: "gemini-2.5-flash", maxTokens: 1024, temperature: 0.7 },
];

const fixtures = [
  {
    name: "haiku-3-providers",
    prompt: "Write a haiku about debugging",
  },
  {
    name: "code-review-3-providers",
    prompt:
      "Review this JavaScript function for bugs and suggest improvements: function fib(n){return n<2?n:fib(n-1)+fib(n-2)}",
  },
];

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 15_000;

async function runWithRetry(runner, prompt, models) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const results = await runner.run({ prompt, models });
    const errors = results.filter((r) => r.error);
    if (!errors.length) return results;
    if (attempt < MAX_RETRIES) {
      console.log(`  ⟳ ${errors.length} error(s), retrying in ${RETRY_DELAY_MS / 1000}s (attempt ${attempt}/${MAX_RETRIES})...`);
      for (const e of errors) console.log(`    ${e.spec.provider}: ${e.error.message}`);
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    } else {
      return results;
    }
  }
}

const runner = new Runner();
await mkdir("fixtures", { recursive: true });

for (const fix of fixtures) {
  const path = `fixtures/${fix.name}.json`;
  try {
    await access(path);
    console.log(`\n>>> Skipping: ${fix.name} (already exists)`);
    continue;
  } catch {}

  console.log(`\n>>> Running: ${fix.name}`);
  const results = await runWithRetry(runner, fix.prompt, models);

  const errors = results.filter((r) => r.error);
  if (errors.length) {
    console.error(`  ✗ ${errors.length} error(s) after ${MAX_RETRIES} attempts:`);
    for (const e of errors) console.error(`    ${e.spec.provider}: ${e.error.message}`);
    process.exit(1);
  }

  await writeFile(path, JSON.stringify(results, null, 2) + "\n", "utf8");
  console.log(`  ✓ saved ${path} (${results.length} results)`);
}

console.log("\nDone — all fixtures saved.");
