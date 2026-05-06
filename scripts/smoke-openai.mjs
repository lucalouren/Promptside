import dotenv from "dotenv";
dotenv.config({ override: true });
import { Runner } from "../dist/runner/index.js";

const runner = new Runner();
const results = await runner.run({
  prompt: "Reply with the exact string: PONG",
  models: [
    { provider: "openai", model: "gpt-5", maxTokens: 16 },
  ],
});
console.log(JSON.stringify(results, null, 2));
