# promptside

> Talk to every LLM at once. Side by side, in your terminal.

`promptside` is a multi-model chat playground for the terminal. Run the same prompt across Claude, GPT, Gemini, Grok, DeepSeek, and Kimi — or drop into an interactive REPL and have a multi-turn conversation with all of them simultaneously.

```bash
npx promptside
```

No config. No dashboard. Just type and compare.

![promptside demo](./assets/demo.gif)

## Quick start

```bash
# Interactive mode — chat with multiple models at once
npx promptside

# One-shot comparison
npx promptside "Explain monads in one sentence" \
  --models claude-sonnet-4-5,gpt-4.1,gemini-2.5-flash

# Use one API key for all models via OpenRouter
export OPENROUTER_API_KEY=sk-or-...
npx promptside
```

## Install

```bash
npm install -g promptside
# or run directly with npx (no install needed)
npx promptside
```

## Supported models

| Provider | Models | Env var |
|---|---|---|
| Anthropic | `claude-opus-4-7`, `claude-sonnet-4-5`, `claude-haiku-3-5` | `ANTHROPIC_API_KEY` |
| OpenAI | `gpt-5`, `gpt-4.1`, `gpt-4.1-mini`, `gpt-4.1-nano` | `OPENAI_API_KEY` |
| Google | `gemini-2.5-pro`, `gemini-2.5-flash` | `GOOGLE_API_KEY` |
| xAI | `grok-3`, `grok-3-mini` | `XAI_API_KEY` |
| DeepSeek | `deepseek-r1`, `deepseek-v3` | `DEEPSEEK_API_KEY` |
| Kimi | `kimi-k2` | `KIMI_API_KEY` |
| **OpenRouter** | **All of the above with one key** | `OPENROUTER_API_KEY` |

## Usage

### Interactive mode (REPL)

Just run `promptside` with no arguments:

```bash
promptside
```

Type prompts, see side-by-side results. Each model maintains its own conversation history — multi-turn works out of the box.

Commands: `/models`, `/clear`, `/help`, `/quit`

### One-shot comparison

```bash
promptside "Write a haiku about debugging" \
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
max_tokens: 1024
---

Write a haiku about debugging.
````

Then:

```bash
promptside run examples/demo-haiku.prompt.md
```

### Watch mode

Re-run automatically on file save:

```bash
promptside run myprompt.prompt.md --watch
```

### HTML report

```bash
promptside "your prompt" --models claude-opus-4-7,gpt-5 --html report.html
open report.html
```

## API keys

Set per-provider keys in your environment or a `.env` file:

```bash
export ANTHROPIC_API_KEY=...
export OPENAI_API_KEY=...
export GOOGLE_API_KEY=...
```

Or use **one key for everything** with [OpenRouter](https://openrouter.ai):

```bash
export OPENROUTER_API_KEY=sk-or-...
```

`promptside` only calls the providers you actually use. If a direct provider key is set, it's used; otherwise it falls back to OpenRouter.

> **Note:** Gemini's free tier has aggressive rate limits and may return 503/429 errors during peak demand. If you hit this, wait a few minutes or switch to a paid API key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey).

## Output

Each run captures, per model:

- Full output text
- Input / output tokens
- Latency (ms)
- Cost (USD)
- Word-level diff against the other models' outputs (HTML report)

## Roadmap

- [x] 6 providers: Anthropic, OpenAI, Google, xAI, DeepSeek, Kimi
- [x] OpenRouter support (one key for all models)
- [x] Interactive REPL with multi-turn conversation
- [x] Terminal + HTML renderers
- [x] `.prompt.md` files with frontmatter
- [x] Watch mode
- [ ] Streaming output
- [ ] Local model support (Ollama)
- [ ] Variable substitution in prompt files
- [ ] CI mode (exit code on regression)

## Contributing

PRs welcome. Adapter contributions especially appreciated — see `src/adapters/` for the pattern.

## License

MIT

---

Built by [@lucalouren](https://github.com/lucalouren). If `promptside` saves you time, a star helps a lot.
