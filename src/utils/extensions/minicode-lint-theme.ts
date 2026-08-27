import { EditorView } from "@codemirror/view";

export const MinicodeLintTheme = EditorView.baseTheme({
  // Marks
  ".cm-lintRange": {
    backgroundPosition: "left bottom",
    backgroundRepeat: "repeat-x",
    paddingBottom: "0.7px",
  },

  ".cm-lintRange-error": {
    textDecoration: "underline wavy var(--minicode-error)",
  },
  ".cm-lintRange-warning": {
    textDecoration: "underline wavy var(--minicode-warning)",
  },
  ".cm-lintRange-info": {
    textDecoration: "underline wavy var(--minicode-info)",
  },
  ".cm-lintRange-hint": {
    textDecoration: "underline wavy var(--minicode-hint)",
  },

  ".cm-lintPoint": {
    position: "relative",

    "&:after": {
      content: '""',
      position: "absolute",
      bottom: 0,
      left: "-2px",
      borderLeft: "3px solid transparent",
      borderRight: "3px solid transparent",
      borderBottom: "4px solid var(--minicode-error)",
    },
  },

  ".cm-lintPoint-warning": {
    "&:after": { borderBottomColor: "var(--minicode-warning)" },
  },
  ".cm-lintPoint-info": {
    "&:after": { borderBottomColor: "var(--minicode-info)" },
  },
  ".cm-lintPoint-hint": {
    "&:after": { borderBottomColor: "var(--minicode-hint)" },
  },

  // Gutter
  ".minicode-cm-lint-gutter": {
    width: "1.4em",
    backgroundColor: "var(--minicode-gutter-bg)",
    "& .cm-gutterElement": {
      padding: ".2em",
    },
  },

  // Shared
  ".cm-tooltip-lint": {
    padding: 0,
    margin: 0,
  },

  ".cm-diagnostic": {
    padding: "3px 6px 3px 8px",
    marginLeft: "-1px",
    display: "block",
    whiteSpace: "pre-wrap",
  },

  ".cm-diagnostic-error": { borderLeft: "5px solid var(--minicode-error)" },
  ".cm-diagnostic-warning": { borderLeft: "5px solid var(--minicode-warning)" },
  ".cm-diagnostic-info": { borderLeft: "5px solid var(--minicode-info)" },
  ".cm-diagnostic-hint": { borderLeft: "5px solid var(--minicode-hint)" },

  ".cm-diagnosticSource": {
    fontSize: "70%",
    opacity: 0.7,
  },
});
