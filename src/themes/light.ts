import type { Theme } from "./index";
import { lightSyntaxStyle } from "./syntax";

export const lightTheme: Theme = {
  name: "light",
  dark: false,

  bg: "#ffffff",
  fg: "#333333",
  muted: "#888888",
  hover: "#f0f0f0",
  active: "#e0e8f0",
  activeFg: "#000000",
  border: "#dddddd",
  accent: "#007acc",

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

  syntax: lightSyntaxStyle,
};
