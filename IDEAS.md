# Ideas (post-v0.1)

A scratchpad. None of this is committed scope. Items here go through the
launch first; we revisit after Saturday.

## Provider coverage

- **gemini-2.5-pro as opt-in.** v0.1 defaults to gemini-2.5-flash because
  Pro is paid-tier-only and the launch needs a zero-friction free path.
  Once a user has GCP billing enabled, document how to upgrade:
  `--models google:gemini-2.5-pro` should "just work" — the adapter and
  pricing entry already exist. Add a docs section ("Using Gemini 2.5 Pro")
  that walks through enabling billing on a GCP project + generating a
  paid AI Studio key.
- Local model support via Ollama (already on the public roadmap).
- Azure OpenAI deployments (different endpoint shape than OpenAI direct).

## Renderer

- Streaming output in the terminal renderer (live token deltas).
- HTML renderer: a per-pair full diff toggle, not just baseline-vs-each.
- Token-level cost coloring: heat-map the output by per-token cost so
  expensive completions are visibly expensive.

## Prompt files

- Variable substitution (`{{name}}`) so a single prompt file can sweep
  inputs.
- Per-model overrides inside frontmatter (`models: [{ model: "...",
  temperature: 0 }, ...]`).
- A small `promptside init` that scaffolds an example file.

## CI / regression mode

- `--baseline <previous.json>` writes/reads a JSON snapshot of run
  results; non-zero exit code if any output drifts more than X%
  character-edit distance.

## Distribution

- Single-binary build via `pkg` so `curl | sh` works without Node.
- Homebrew formula.
