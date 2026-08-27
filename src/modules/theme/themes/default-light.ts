import type { Theme } from "./index";
import { lightSyntaxStyle } from "./syntax";

export const lightTheme: Theme = {
  name: "Default Light",
  variant: "light",

  bg: "#ffffff",
  fg: "#333333",
  muted: "#888888",
  hover: "#f0f0f0",
  active: "#e0e8f0",
  activeFg: "#000000",
  border: "#dddddd",
  accent: "#007acc",
  info: "#7272eb",
  error: "#ea3424",
  warn: "#ebcd19",
  hint: "#00897b",

  editorBg: "#ffffff",
  editorFg: "#333333",
  gutterBg: "#ffffff",
  gutterFg: "#888888",
  activeLine: "#f0f0f0",
  activeLineGutter: "#e0e8f0",
  selection: "#add6ff",
  cursor: "#333333",
  whitespace: "#dddddd",
  matchingBracket: "#c9d5e5",

  inputBg: "#f0f0f0",
  inputFg: "#333333",
  inputBorder: "#cccccc",
  inputHover: "#e0e0e0",
  inputFocus: "#007acc",

  syntax: lightSyntaxStyle,
};
