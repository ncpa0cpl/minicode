import type { Theme } from "./index";

const UI_TOKEN_MAP: Partial<Record<keyof Theme, string>> = {
  name: "--minicode-name",
  dark: "--minicode-dark",
  bg: "--minicode-bg",
  fg: "--minicode-fg",
  muted: "--minicode-muted",
  hover: "--minicode-hover",
  active: "--minicode-active",
  activeFg: "--minicode-active-fg",
  border: "--minicode-border",
  accent: "--minicode-accent",
  editorBg: "--minicode-editor-bg",
  editorFg: "--minicode-editor-fg",
  gutterBg: "--minicode-gutter-bg",
  gutterFg: "--minicode-gutter-fg",
  activeLine: "--minicode-active-line",
  activeLineGutter: "--minicode-active-line-gutter",
  selection: "--minicode-selection",
  cursor: "--minicode-cursor",
  whitespace: "--minicode-whitespace",
  matchingBracket: "--minicode-matching-bracket",
  fileTypeColors: "--minicode-file-type-colors",
};

export function themeToCssVars(theme: Theme): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const key in theme) {
    const k = key as keyof Theme;
    const v = theme[k];
    const varName = UI_TOKEN_MAP[k];
    if (typeof v === "string" && varName) {
      vars[varName] = v;
    }
  }
  vars["--minicode-font"] = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';
  return vars;
}
