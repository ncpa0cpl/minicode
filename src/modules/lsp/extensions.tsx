import type { EditorView, PluginValue, Tooltip, ViewUpdate } from "@codemirror/view";
import { ViewPlugin, hoverTooltip } from "@codemirror/view";
import type { Extension } from "@codemirror/state";
import type { HighlightStyle } from "@codemirror/language";
import {
  autocompletion,
  type Completion,
  type CompletionContext,
  type CompletionResult,
} from "@codemirror/autocomplete";
import type { LspManager } from "./manager";
import type { CompletionItem, Hover, MarkupContent } from "./types";
import { File } from "../../files";
import { highlightCodeToHtml, prettifyErrorMessage } from "./highlight";

declare class TrustedHTML {}

type HTMLTrustPolicy = {
  createHTML(html: string): string & TrustedHTML;
};

declare const trustedTypes:
  | undefined
  | {
      createPolicy(
        name: string,
        opts: {
          createHTML: (str: string) => string;
        },
      ): HTMLTrustPolicy;
    };

function trustHtmlFactory() {
  if (typeof trustedTypes === "undefined") return (html: string) => html;

  const trustedHTMLPolicy = trustedTypes.createPolicy("myEscapePolicy", {
    createHTML: (string) => string,
  });

  return (html: string) => trustedHTMLPolicy.createHTML(html);
}

const trustHtml = trustHtmlFactory();

export function createLspExtensions(
  manager: LspManager,
  file: File,
  getStyle: () => HighlightStyle | undefined,
): Extension[] {
  const ext = file.ext;
  if (!ext || !manager.hasLsp(ext)) return [];

  return [
    // Prec.low(lintGutter()),
    ViewPlugin.define((view) => new LspDocSyncPlugin(view, manager, file)),
    autocompletion({
      override: [
        (ctx: CompletionContext): Promise<CompletionResult | null> => {
          return lspCompletionSource(manager, file, ctx);
        },
      ],
    }),
    hoverTooltip((view, pos, _side) => lspHoverTooltip(manager, file, view, pos, getStyle), {
      hideOnChange: true,
    }),
  ];
}

class LspDocSyncPlugin implements PluginValue {
  constructor(
    private view: EditorView,
    private manager: LspManager,
    private file: File,
  ) {
    this.manager.openDocument(file.ext!, file.path, view.state.doc.toString(), view).catch(() => {
      // openDocument logs internally via LspManager
    });
  }

  update(update: ViewUpdate) {
    if (update.docChanged) {
      this.manager.changeDocument(this.file.path, update.state.doc.toString());
    }
  }

  destroy() {
    this.manager.closeDocument(this.file.path);
  }
}

async function lspCompletionSource(
  manager: LspManager,
  file: File,
  ctx: CompletionContext,
): Promise<CompletionResult | null> {
  const word = ctx.matchBefore(/[\w$]+/);
  if (!word && !ctx.explicit) return null;

  const result = await manager.completion(file.ext!, file.path, ctx.pos, ctx.state.doc);
  if (!result || result.items.length === 0) return null;

  const from = word ? word.from : ctx.pos;
  const to = word ? word.to : ctx.pos;

  return {
    from,
    to,
    options: result.items.map(convertCompletionItem),
    validFor: /[\w$]+/,
  };
}

function convertCompletionItem(item: CompletionItem): Completion {
  return {
    label: item.label,
    detail: item.detail,
    type: lspKindToCmType(item.kind),
    apply: item.insertText ?? item.label,
    info: extractDoc(item.documentation),
  };
}

function lspKindToCmType(kind: number | undefined): Completion["type"] {
  switch (kind) {
    case 1:
      return "text";
    case 2:
      return "method";
    case 3:
      return "function";
    case 4:
      return "class";
    case 5:
      return "property";
    case 6:
      return "variable";
    case 7:
      return "class";
    case 8:
      return "type";
    case 9:
      return "module";
    case 10:
      return "property";
    case 13:
      return "enum";
    case 14:
      return "keyword";
    case 15:
      return "snippet";
    case 16:
      return "variable";
    case 17:
      return "file";
    default:
      return undefined;
  }
}

function extractDoc(doc: string | MarkupContent | undefined): string | undefined {
  if (!doc) return undefined;
  if (typeof doc === "string") return doc;
  if ("value" in doc) return doc.value;
  return undefined;
}

async function lspHoverTooltip(
  manager: LspManager,
  file: File,
  view: EditorView,
  pos: number,
  getStyle: () => HighlightStyle | undefined,
): Promise<Tooltip | null> {
  const result = await manager.hover(file.ext!, file.path, pos, view.state.doc);
  if (!result) return null;

  const text = extractHoverText(result);
  if (!text) return null;

  const MAX_CHARS = 2000;
  const truncated = text.length > MAX_CHARS;
  const displayText = truncated ? text.slice(0, MAX_CHARS) : text;

  return {
    pos,
    above: true,
    create() {
      const dom = document.createElement("div");
      dom.className = "cm-lsp-hover";
      renderHoverContent(dom, displayText, getStyle());
      if (truncated) {
        const more = (
          <div
            style={{
              marginTop: 4,
              color: "var(--minicode-muted, #6b7280)",
              fontStyle: "italic",
              fontSize: 11,
            }}
          >
            ... (truncated)
          </div>
        );
        dom.appendChild(more);
      }
      return { dom };
    },
  };
}

function extractHoverText(hover: Hover): string | null {
  const contents = hover.contents;
  if (typeof contents === "string") return contents;
  if (Array.isArray(contents)) {
    return contents.map((c) => (typeof c === "string" ? c : c.value)).join("\n\n");
  }
  if (typeof contents === "object" && "value" in contents) {
    return contents.value;
  }
  return null;
}

function renderHoverContent(dom: HTMLElement, text: string, highlightStyle?: HighlightStyle) {
  const lines = text.split("\n");
  let inCodeBlock = false;
  const fragments: HTMLElement[] = [];
  let codeLines: string[] = [];

  const flushCode = () => {
    if (codeLines.length === 0) return;
    const code = codeLines.join("\n");
    const pre = document.createElement("pre");
    pre.className = "cm-codeblock";
    if (highlightStyle) {
      pre.innerHTML = trustHtml(highlightCodeToHtml(code, highlightStyle));
    } else {
      pre.textContent = code;
    }
    fragments.push(pre);
    codeLines = [];
  };

  for (const line of lines) {
    if (line.startsWith("```")) {
      if (inCodeBlock) {
        flushCode();
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }
    if (inCodeBlock) {
      codeLines.push(line);
    } else {
      if (line.trim().length > 0) {
        if (highlightStyle && /'[^']{2,}'/.test(line)) {
          const p = (<div className="cm-hover-msg" />) as HTMLElement;
          p.innerHTML = trustHtml(prettifyErrorMessage(line, highlightStyle));
          fragments.push(p);
        } else {
          fragments.push((<div className="cm-hover-msg">{line}</div>) as HTMLElement);
        }
      }
    }
  }
  flushCode();

  for (const f of fragments) dom.appendChild(f);
}
