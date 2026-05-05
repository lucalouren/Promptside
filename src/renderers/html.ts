import type { RenderInput, Renderer } from "../types/index.js";

export class HtmlRenderer implements Renderer {
  readonly target = "html" as const;

  render(_input: RenderInput): string {
    throw new Error("HtmlRenderer.render not implemented (Step 3)");
  }
}
