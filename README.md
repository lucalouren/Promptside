# promptdiff

> See how your prompt performs across LLMs — side by side, in seconds.

`promptdiff` runs the same prompt across multiple language models and shows you a beautiful side-by-side comparison of outputs, token usage, latency, and cost. Built for the workflow every AI dev now has: *"a new model dropped — did my prompts regress?"*

```bash
npx promptdiff "Explain transformers to a 10-year-old" \
  --models claude-opus-4-7,gpt-5,gemini-2.5-flash
```

Outputs a side-by-side terminal view and a self-contained HTML report you can share.

![promptdiff demo](./assets/demo.gif)

## Why

Every time a new frontier model ships, you want to know:

- Does my prompt still work?
- Which model gives the best answer for *my* use case?
- What's the cost/latency tradeoff?

Existing tools (Promptfoo, Braintrust, etc.) are powerful but heavy — config files, eval frameworks, dashboards, signups. `promptdiff` is the opposite: one command, no signup, instant visual diff.

## Install

```bash
npm install -g promptdiff
# or run directly
npx promptdiff
```

## Usage

### Quick comparison

```bash
promptdiff "Write a haiku about debugging" \
  --models claude-opus-4-7,gpt-5,gemini-2.5-flash
```

### From a prompt file

Create a `.prompt.md` file (see `examples/` for more):

````markdown
---
models:
  - anthropic:claude-opus-4-7
  - openai:gpt-5
  - google:gemini-2.5-flash
max_tokens: 64
---

Write a haiku about debugging.
````

Then:

```bash
promptdiff run examples/demo-haiku.prompt.md
```

### Watch mode

Re-run automatically on file save:

```bash
promptdiff run myprompt.prompt.md --watch
```

### HTML report

```bash
promptdiff "your prompt" --models claude-opus-4-7,gpt-5 --html report.html
open report.html
```

## API keys

Set these in your environment:

```bash
export ANTHROPIC_API_KEY=...
export OPENAI_API_KEY=...
export GOOGLE_API_KEY=...
```

`promptdiff` only calls the providers you actually use.

## Output

Each run captures, per model:

- Full output text
- Input / output tokens
- Latency (ms)
- Cost (USD)
- Character-level diff against the other models' outputs

## Comparison

| | promptdiff | Promptfoo | Braintrust |
|---|---|---|---|
| Setup time | 30 seconds | ~10 min | Signup required |
| Config | Optional `.prompt.md` | YAML eval files | Cloud dashboard |
| Local-first | ✅ | ✅ | ❌ |
| Visual diff | ✅ | ❌ | Partial |
| Eval framework | ❌ (by design) | ✅ | ✅ |
| Best for | Quick prompt comparisons | Full eval pipelines | Team prompt management |

`promptdiff` is the tool you reach for when a model drops and you want to know in 30 seconds whether your prompts still work. For full eval pipelines, use Promptfoo. For team workflows, use Braintrust.

## Roadmap

- [x] Anthropic, OpenAI, Google adapters
- [x] Terminal + HTML renderers
- [x] `.prompt.md` files with frontmatter
- [x] Watch mode
- [ ] Local model support (Ollama)
- [ ] Streaming output
- [ ] Variable substitution in prompt files
- [ ] CI mode (exit code on regression)

## Contributing

PRs welcome. Adapter contributions especially appreciated — see `src/adapters/` for the pattern.

## License

MIT

---

Built by [@lucalouren](https://github.com/lucalouren). If `promptdiff` saves you time, a star helps a lot. ⭐
