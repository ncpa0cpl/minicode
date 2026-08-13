import { EditorView } from "@codemirror/view";
import type { Extension } from "@codemirror/state";
import type { Theme } from "./index";

function withAlpha(hex: string, alpha: number): string {
  const m = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.exec(hex.trim());
  if (!m) return hex;
  let h = m[1]!;
  if (h.length === 3) {
    h = h[0]! + h[0]! + h[1]! + h[1]! + h[2]! + h[2]!;
  }
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function defineCodeMirrorTheme(theme: Theme): Extension {
  return EditorView.theme(
    {
      "&": {
        backgroundColor: theme.editorBg,
        color: theme.editorFg,
        height: "100%",
      },
      "& .cm-scroller": {
        fontFamily: 'var(--minicode-font, ui-monospace, "SF Mono", Menlo, Consolas, monospace)',
        overflow: "auto",
        scrollbarWidth: "thin",
        scrollbarColor: `${theme.border} transparent`,
      },
      ".cm-gutters": {
        backgroundColor: theme.gutterBg,
        color: theme.gutterFg,
        border: "none",
      },
      "&.cm-focused": {
        outline: "none",
      },
      "& .cm-activeLine": {
        backgroundColor: withAlpha(theme.activeLine, 0.35),
      },
      ".cm-activeLineGutter": {
        backgroundColor: withAlpha(theme.activeLineGutter, 0.5),
      },
      "& .cm-selectionBackground": {
        background: theme.selection,
      },
      "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground": {
        background: theme.selection,
      },
      "::selection": {
        background: theme.selection,
      },
      "& .cm-cursor": {
        borderLeftColor: theme.cursor,
      },
      "& .cm-whitespace::before": {
        color: theme.whitespace,
      },
      "& .cm-matchingBracket, & .cm-nonmatchingBracket": {
        backgroundColor: theme.matchingBracket,
        outline: "none",
      },
      "& .cm-foldPlaceholder": {
        backgroundColor: theme.hover,
        border: `1px solid ${theme.border}`,
        color: theme.muted,
        borderRadius: ".2em",
        margin: "0 1px",
        padding: "0 1px",
        cursor: "pointer",
      },
      "& .cm-scroller::-webkit-scrollbar": {
        width: "10px",
        height: "10px",
      },
      "& .cm-scroller::-webkit-scrollbar-track": {
        background: "transparent",
      },
      "& .cm-scroller::-webkit-scrollbar-thumb": {
        backgroundColor: theme.border,
        borderRadius: "5px",
        border: `2px solid ${theme.editorBg}`,
      },
      "& .cm-scroller::-webkit-scrollbar-thumb:hover": {
        backgroundColor: theme.muted,
      },
      "& .cm-scroller::-webkit-scrollbar-corner": {
        background: "transparent",
      },
      ".cm-tooltip": {
        backgroundColor: theme.bg,
        border: `1px solid ${theme.border}`,
        borderRadius: "6px",
        boxShadow: "0 6px 16px rgba(0, 0, 0, 0.4)",
        fontFamily: 'var(--minicode-font, ui-monospace, "SF Mono", Menlo, Consolas, monospace)',
        fontSize: "13px",
        color: theme.fg,
      },
      ".cm-tooltip-autocomplete > ul": {
        fontFamily: 'var(--minicode-font, ui-monospace, "SF Mono", Menlo, Consolas, monospace)',
      },
      ".cm-tooltip-autocomplete > ul > li": {
        padding: "2px 8px",
      },
      ".cm-tooltip.cm-lsp-hover": {
        backgroundColor: theme.editorBg,
        border: `1px solid ${theme.border}`,
        borderRadius: "6px",
        boxShadow: "0 6px 16px rgba(0, 0, 0, 0.4)",
        padding: "8px 12px",
        maxWidth: "min(500px, 80vw)",
        maxHeight: "300px",
        overflow: "auto",
        color: theme.editorFg,
        fontFamily: 'var(--minicode-font, ui-monospace, "SF Mono", Menlo, Consolas, monospace)',
        fontSize: "12px",
        lineHeight: "1.5",
        userSelect: "text",
        wordWrap: "break-word",
        overflowWrap: "anywhere",
      },
      ".cm-lsp-hover .cm-codeblock": {
        backgroundColor: withAlpha(theme.bg, 0.5),
        padding: "6px 8px",
        margin: "4px 0",
        overflowX: "auto",
        maxWidth: "85cqw",
        fontFamily: 'var(--minicode-font, ui-monospace, "SF Mono", Menlo, Consolas, monospace)',
        fontSize: "12px",
        whiteSpace: "pre-wrap",
        wordBreak: "break-all",
      },
      ".cm-lsp-hover .cm-hover-msg": {
        paddingInline: "16px",
        paddingBottom: "6px",
        fontSize: "10px",
      },
      ".cm-lsp-hover .cm-hover-msg:last-child": {
        paddingBottom: "16px",
      },
      ".cm-lsp-hover code.lsp-type": {
        backgroundColor: withAlpha(theme.bg, 0.5),
        padding: "1px 4px",
        borderRadius: "3px",
        fontFamily: 'var(--minicode-font, ui-monospace, "SF Mono", Menlo, Consolas, monospace)',
        fontSize: "12px",
        whiteSpace: "pre-wrap",
      },
      ".cm-lsp-hover pre": {
        margin: "4px 0",
      },
    },
    { dark: theme.variant === "dark" },
  );
}
