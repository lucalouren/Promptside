import type { RenderInput, Renderer } from "../types/index.js";

export class TerminalRenderer implements Renderer {
  readonly target = "terminal" as const;

  render(_input: RenderInput): string {
    throw new Error("TerminalRenderer.render not implemented (Step 2)");
  }
}
