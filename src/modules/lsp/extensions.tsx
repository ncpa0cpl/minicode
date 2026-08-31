import { ViewPlugin, hoverTooltip, keymap, EditorView } from "@codemirror/view";
import type { PluginValue, Tooltip, ViewUpdate } from "@codemirror/view";
import { EditorSelection, type Extension } from "@codemirror/state";
import type { HighlightStyle } from "@codemirror/language";
import {
  autocompletion,
  type Completion,
  type CompletionContext,
  type CompletionResult,
} from "@codemirror/autocomplete";
import {
  hoverTooltips,
  signatureHelp,
  formatKeymap,
  renameKeymap,
  jumpToDefinition,
  jumpToDefinitionKeymap,
  findReferencesKeymap,
} from "@codemirror/lsp-client";
import type { LspManager } from "./manager";
import { languageIdForExt, lspToCmPos } from "./manager";
import type { CompletionItem, Hover, MarkupContent, TextEdit } from "./types";
import { toUri } from "./types";
import { File } from "../../files";
import { highlightCodeToHtml, prettifyErrorMessage } from "./highlight";
import { trustHtml } from "./sanitize";

export function createLspExtensions(
  manager: LspManager,
  file: File,
  getStyle: () => HighlightStyle | undefined,
): Extension[] {
  const ext = file.ext;
  if (!ext || !manager.hasLsp(ext)) return [];

  const primary = manager.ensurePrimaryClient(ext);
  if (!primary) return [];

  const uri = toUri(file.path);
  const languageId = languageIdForExt(ext);

  const editorExt: Extension[] = [
    // LSP plugin — must come first so its `update` accumulates unsynced
    // changes before the doc-sync plugin below flushes them via `client.sync()`.
    primary.plugin(uri, languageId),
    signatureHelp(),
    keymap.of([
      ...formatKeymap,
      ...renameKeymap,
      ...jumpToDefinitionKeymap,
      ...findReferencesKeymap,
    ]),
    // Ctrl+Click (Cmd+Click on macOS) jumps to the definition of the symbol
    // under the pointer.
    EditorView.domEventHandlers({
      mousedown(event, view) {
        if (!(event.ctrlKey || event.metaKey) || event.button !== 0) return false;
        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
        if (pos == null || pos < 0) return false;
        view.dispatch({ selection: { anchor: pos } });
        event.preventDefault();
        return jumpToDefinition(view);
      },
      mousemove(event, view) {
        if (!(event.ctrlKey || event.metaKey)) {
          view.dom.style.removeProperty("cursor");
          return false;
        }
        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
        if (pos == null || pos < 0) {
          view.dom.style.removeProperty("cursor");
          return false;
        }
        view.dom.style.cursor = "pointer";
        return false;
      },
      mouseleave(_event, view) {
        view.dom.style.removeProperty("cursor");
        return false;
      },
    }),
    autocompletion({
      override: [
        (ctx: CompletionContext): Promise<CompletionResult | null> => {
          return lspCompletionSource(manager, file, ctx);
        },
      ],
    }),
  ];

  // Hover: minicode's custom rendering for the JS/TS family (preserves the
  // existing look & feel + TS error prettification); the package's hover
  // tooltips for everything else.
  if (manager.useCustomHover(ext)) {
    editorExt.push(
      hoverTooltip((view, pos, _side) => lspHoverTooltip(manager, file, view, pos, getStyle), {
        hideOnChange: true,
      }),
    );
  } else {
    editorExt.push(hoverTooltips());
  }

  // Doc sync — drives secondary clients (manual didOpen/didChange/didClose),
  // diagnostic pulls, and flushes the primary client's unsynced changes.
  editorExt.push(ViewPlugin.define((view) => new LspDocSyncPlugin(view, manager, file)));

  return editorExt;
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
      this.manager.changeDocument(this.file.path);
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
    options: result.items.map((item) => convertCompletionItem(manager, file, item)),
    validFor: /[\w$]+/,
  };
}

export function convertCompletionItem(
  manager: LspManager,
  file: File,
  item: CompletionItem,
): Completion {
  const insertText = item.insertText ?? item.label;

  // Fast path: if the server already included additional edits (the import
  // statement), apply them together with the main insert in one transaction.
  // Otherwise resolve lazily on accept — the resolve request may return
  // additionalTextEdits for auto-import items.
  const hasEdits = !!item.additionalTextEdits && item.additionalTextEdits.length > 0;

  return {
    label: item.label,
    detail: item.detail,
    type: lspKindToCmType(item.kind),
    apply: hasEdits
      ? (view, _completion, from, to) => {
          view.dispatch({
            changes: [
              { from, to, insert: insertText },
              ...editsToChanges(view, item.additionalTextEdits!),
            ],
            selection: EditorSelection.cursor(to),
            userEvent: "input.complete",
          });
        }
      : async (view, _completion, from, to) => {
          // Insert the main completion text first.
          view.dispatch({
            changes: { from, to, insert: insertText },
            userEvent: "input.complete",
          });

          // Resolve the item to fetch any additional edits (auto-imports).
          try {
            const resolved = await manager.resolveCompletion(file.ext!, item);
            const edits = resolved?.additionalTextEdits;
            if (edits && edits.length > 0) {
              view.dispatch({
                changes: editsToChanges(view, edits),
                userEvent: "input.complete",
              });
            }
          } catch {
            // Resolve is best-effort — the completion itself is already applied.
          }
        },
    info: extractDoc(item.documentation),
    sortText: item.sortText,
  };
}

/**
 * Converts LSP text edits (line/character based) into CodeMirror changes
 * (offset based) against the current document state.
 */
function editsToChanges(
  view: EditorView,
  edits: TextEdit[],
): Array<{ from: number; to: number; insert: string }> {
  return edits
    .map((e) => ({
      from: lspToCmPos(view.state.doc, e.range.start),
      to: lspToCmPos(view.state.doc, e.range.end),
      insert: e.newText,
    }))
    .sort((a, b) => a.from - b.from);
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
              marginTop: "0.31em",
              color: "var(--minicode-muted, #6b7280)",
              fontStyle: "italic",
              fontSize: "0.85em",
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
