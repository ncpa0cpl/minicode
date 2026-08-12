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
    },
    { dark: theme.variant === "dark" },
  );
}
