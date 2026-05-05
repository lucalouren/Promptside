import "dotenv/config";
import { Runner } from "../dist/runner/index.js";

const runner = new Runner();
const results = await runner.run({
  prompt: "Reply with the exact string: PONG",
  models: [
    { provider: "anthropic", model: "claude-opus-4-7", maxTokens: 16, temperature: 0 },
  ],
});
console.log(JSON.stringify(results, null, 2));
