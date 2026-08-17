import type { Theme } from "./index";
import { darkSyntaxStyle } from "./syntax";

export const darkTheme: Theme = {
  name: "Default Dark",
  variant: "light",

  bg: "#1b1f27",
  fg: "#cdd3de",
  muted: "#6b7280",
  hover: "#232834",
  active: "#2c3344",
  activeFg: "#ffffff",
  border: "#2a2f3a",
  accent: "#4b9fff",

  editorBg: "#1b1f27",
  editorFg: "#cdd3de",
  gutterBg: "#1b1f27",
  gutterFg: "#6b7280",
  activeLine: "#232834",
  activeLineGutter: "#2c3344",
  selection: "#264f78",
  cursor: "#aeafad",
  whitespace: "#3a3f4b",
  matchingBracket: "#3a4055",

  inputBg: "#232834",
  inputFg: "#cdd3de",
  inputBorder: "#2a2f3a",
  inputHover: "#2c3344",
  inputFocus: "#4b9fff",

  syntax: darkSyntaxStyle,
};
