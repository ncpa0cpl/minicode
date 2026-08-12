import type { HighlightStyle } from "@codemirror/language";

export interface Theme {
  name: string;
  variant: "dark" | "light";

  bg: string;
  fg: string;
  muted: string;
  hover: string;
  active: string;
  activeFg: string;
  border: string;
  accent: string;

  editorBg: string;
  editorFg: string;
  gutterBg: string;
  gutterFg: string;
  activeLine: string;
  activeLineGutter: string;
  selection: string;
  cursor: string;
  whitespace: string;
  matchingBracket: string;

  fileTypeColors?: Record<string, string>;

  syntax?: HighlightStyle;
}

export type ThemeName = "dark" | "light" | (string & {});

export type ThemeInput = ThemeName | Theme;

export { darkTheme } from "./default-dark";
export { lightTheme } from "./default-light";
export { gnomeDarkTheme } from "./gnome-dark";
export { gnomeLightTheme } from "./gnome-light";
export { themeToCssVars } from "./css-vars";
export { defineCodeMirrorTheme } from "./codemirror";
export { defineSyntaxHighlighting, darkSyntaxStyle, lightSyntaxStyle } from "./syntax";
export type { HighlightStyle } from "@codemirror/language";
