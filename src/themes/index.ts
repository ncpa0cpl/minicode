import type { HighlightStyle } from "@codemirror/language";

export interface Theme {
  name: ThemeName;
  dark: boolean;

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

import { darkTheme } from "./dark";
import { lightTheme } from "./light";

export const themes: Record<string, Theme> = {
  dark: darkTheme,
  light: lightTheme,
};

export function getTheme(name: ThemeName): Theme {
  return themes[name] ?? darkTheme;
}

export function resolveTheme(input: ThemeInput): Theme {
  if (typeof input === "string") {
    return getTheme(input);
  }
  return input;
}

export { darkTheme } from "./dark";
export { lightTheme } from "./light";
export { themeToCssVars } from "./css-vars";
export { defineCodeMirrorTheme } from "./codemirror";
export { defineSyntaxHighlighting, darkSyntaxStyle, lightSyntaxStyle } from "./syntax";
export type { HighlightStyle } from "@codemirror/language";
