import type { Renderer, RendererTarget } from "../types/index.js";
import { TerminalRenderer } from "./terminal.js";
import { HtmlRenderer } from "./html.js";

export { TerminalRenderer, HtmlRenderer };

export function getRenderer(target: RendererTarget): Renderer {
  switch (target) {
    case "terminal":
      return new TerminalRenderer();
    case "html":
      return new HtmlRenderer();
  }
}
