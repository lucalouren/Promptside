import { readFileSync, writeFileSync } from "node:fs";
import { HtmlRenderer } from "../dist/renderers/html.js";

const [fixturePath, outputPath] = process.argv.slice(2);
if (!fixturePath || !outputPath) {
  console.error("usage: node scripts/render-from-fixture.mjs <fixture.json> <output.html>");
  process.exit(1);
}

const results = JSON.parse(readFileSync(fixturePath, "utf8"));
const prompt = fixturePath.includes("haiku")
  ? "Write a haiku about debugging"
  : "Review this JavaScript function for bugs and suggest improvements: function fib(n){return n<2?n:fib(n-1)+fib(n-2)}";

const renderer = new HtmlRenderer();
const html = renderer.render({ prompt, results, generatedAt: new Date() });
writeFileSync(outputPath, html, "utf8");
console.log(`wrote ${outputPath} (${html.length} bytes)`);
