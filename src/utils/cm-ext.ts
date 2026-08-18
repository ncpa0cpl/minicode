import { Compartment, Extension } from "@codemirror/state";
import {
  highlightActiveLineGutter,
  highlightSpecialChars,
  KeyBinding,
  keymap,
  lineNumbers,
} from "@codemirror/view";
import { EditorView } from "codemirror";
import {
  indentMore,
  indentLess,
  cursorLineStart,
  cursorLineEnd,
  deleteLine,
  cursorDocStart,
  cursorDocEnd,
  defaultKeymap,
  historyKeymap,
  undo,
  redo,
  selectAll,
  toggleComment,
  blockComment,
  blockUncomment,
  copyLineDown,
  copyLineUp,
  insertBlankLine,
  transposeChars,
  toggleLineComment,
  toggleBlockComment,
  moveLineDown,
  moveLineUp,
} from "@codemirror/commands";
import { foldAll, unfoldAll, foldCode, toggleFold, unfoldCode } from "@codemirror/language";
import { MiniCodeContext } from "../context";
import {
  drawSelection,
  highlightActiveLine,
  dropCursor,
  rectangularSelection,
} from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import {
  defaultHighlightStyle,
  syntaxHighlighting,
  indentOnInput,
  bracketMatching,
  foldGutter,
} from "@codemirror/language";
import { history } from "@codemirror/commands";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { closeBrackets, completionKeymap, deleteBracketPair } from "@codemirror/autocomplete";
import { lintKeymap, closeLintPanel, nextDiagnostic, openLintPanel } from "@codemirror/lint";

const DefaultCmKeymap = [
  ...defaultKeymap,
  ...searchKeymap,
  ...historyKeymap,
  ...completionKeymap,
  ...lintKeymap,
];

export type EditorCommand = {
  id: string;
  label: string;
  run: (view: EditorView) => boolean;
};

export type CustomKeybind = {
  key: string;
  command: string;
};

function copyCommand(view: EditorView): boolean {
  const sel = view.state.selection.main;
  if (sel.from === sel.to) return false;
  const text = view.state.sliceDoc(sel.from, sel.to);
  navigator.clipboard.writeText(text).catch(() => {});
  return true;
}

function cutCommand(view: EditorView): boolean {
  const sel = view.state.selection.main;
  if (sel.from === sel.to) return false;
  const text = view.state.sliceDoc(sel.from, sel.to);
  navigator.clipboard.writeText(text).catch(() => {});
  view.dispatch({
    changes: { from: sel.from, to: sel.to },
    userEvent: "input.cut",
  });
  return true;
}

function pasteCommand(view: EditorView): boolean {
  navigator.clipboard
    .readText()
    .then((text) => {
      if (!text) return;
      const dataTransfer = new DataTransfer();
      dataTransfer.setData("text/plain", text);
      const event = new ClipboardEvent("paste", {
        clipboardData: dataTransfer,
        bubbles: true,
        cancelable: true,
      });
      view.contentDOM.dispatchEvent(event);
    })
    .catch(() => {});
  return true;
}

export const editorCommands: EditorCommand[] = [
  { id: "clipboard.copy", label: "Copy", run: copyCommand },
  { id: "clipboard.cut", label: "Cut", run: cutCommand },
  { id: "clipboard.paste", label: "Paste", run: pasteCommand },
  { id: "fold.foldAll", label: "Fold All", run: foldAll },
  { id: "fold.unfoldAll", label: "Unfold All", run: unfoldAll },
  { id: "fold.foldCode", label: "Fold Code", run: foldCode },
  { id: "fold.unfoldCode", label: "Unfold Code", run: unfoldCode },
  { id: "fold.toggleFold", label: "Toggle Fold", run: toggleFold },
  { id: "edit.undo", label: "Undo", run: undo },
  { id: "edit.redo", label: "Redo", run: redo },
  { id: "edit.selectAll", label: "Select All", run: selectAll },
  { id: "edit.deleteLine", label: "Delete Line", run: deleteLine },
  { id: "edit.indentMore", label: "Indent", run: indentMore },
  { id: "edit.indentLess", label: "Unindent", run: indentLess },
  { id: "edit.toggleComment", label: "Toggle Comment", run: toggleComment },
  { id: "edit.blockComment", label: "Comment Selection", run: blockComment },
  { id: "edit.blockUncomment", label: "Uncomment Selection", run: blockUncomment },
  { id: "edit.copyLineDown", label: "Copy Line Down", run: copyLineDown },
  { id: "edit.copyLineUp", label: "Copy Line Up", run: copyLineUp },
  { id: "edit.insertBlankLine", label: "Insert Blank Line", run: insertBlankLine },
  { id: "edit.transposeChars", label: "Transpose Chars", run: transposeChars },
  { id: "edit.toggleLineComment", label: "Toggle Line Comment", run: toggleLineComment },
  { id: "edit.toggleBlockComment", label: "Toggle Block Comment", run: toggleBlockComment },
  { id: "navigate.docStart", label: "Cursor to Document Start", run: cursorDocStart },
  { id: "navigate.docEnd", label: "Cursor to Document End", run: cursorDocEnd },
  { id: "navigate.lineStart", label: "Cursor to Line Start", run: cursorLineStart },
  { id: "navigate.lineEnd", label: "Cursor to Line End", run: cursorLineEnd },
  { id: "navigate.moveLineDown", label: "moveLineDown", run: moveLineDown },
  { id: "navigate.moveLineUp", label: "moveLineUp", run: moveLineUp },
  { id: "lint.openLintPanel", label: "Open Lint Panel", run: openLintPanel },
  { id: "lint.closeLintPanel", label: "Close Lint Panel", run: closeLintPanel },
  { id: "lint.nextDiagnostic", label: "Next Diagnostic", run: nextDiagnostic },
  { id: "autocomplete:deleteBracketPair", label: "Delete Bracket Pair", run: deleteBracketPair },
];

export const editorCommandMap: Record<string, EditorCommand> = Object.fromEntries(
  editorCommands.map((c) => [c.id, c]),
);

function buildCustomKeymap(custom: ReadonlyArray<CustomKeybind>): KeyBinding[] {
  return custom.flatMap(({ key, command }) => {
    const cmd = editorCommandMap[command];
    if (!cmd) return [];
    return [{ key, run: cmd.run, preventDefault: true }];
  });
}

export class CmPlugin {
  constructor(
    private name: string,
    private compartment: Compartment,
    private editor: EditorView,
  ) {}

  /** replaces all extensions with the list given. removes all if none provided */
  replace(...extensions: Extension[]) {
    this.editor.dispatch({
      effects: this.compartment.reconfigure(extensions),
    });
  }
}

export class CmEditor {
  _editor: EditorView;

  private freeCompartments: Compartment[] = [];
  private plugins = new Map<string, CmPlugin>();
  private keymapCompartment = new Compartment();

  constructor(
    private ctx: MiniCodeContext,
    private initialContent: string,
    private onChange: (content: string) => void,
    maxPlugins: number,
  ) {
    this.freeCompartments = Array.from({ length: maxPlugins }, () => {
      return new Compartment();
    });

    this._editor ??= new EditorView({
      doc: this.initialContent,
      root: this.ctx.shadowRoot,
      extensions: [
        this.keymapCompartment.of(keymap.of(this.keymap())),

        // basic setup
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightSpecialChars(),
        history(),
        foldGutter(),
        drawSelection(),
        dropCursor(),
        EditorState.allowMultipleSelections.of(true),
        indentOnInput(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        bracketMatching(),
        closeBrackets(),
        // autocompletion(),
        rectangularSelection(),
        // crosshairCursor(),
        highlightActiveLine(),
        highlightSelectionMatches(),
        // basic setup end

        EditorView.updateListener.of((u) => {
          if (u.docChanged) {
            this.onChange(u.state.doc.toString());
          }
        }),
        ...this.freeCompartments.map((c) => c.of([])),
      ],
    });
  }

  editor() {
    return this._editor;
  }

  addPlugin(name: string): CmPlugin {
    const compartment = this.freeCompartments.pop();
    if (!compartment) {
      throw new Error("max plugins amount exceeded");
    }

    const p = new CmPlugin(name, compartment, this._editor!);
    this.plugins.set(name, p);

    return p;
  }

  getPlugin(name: string): CmPlugin | undefined {
    return this.plugins.get(name);
  }

  getOrAddPlugin(name: string) {
    return this.getPlugin(name) ?? this.addPlugin(name);
  }

  keymap() {
    const customBuiltinKeymaps: KeyBinding[] = [
      {
        key: "Tab",
        preventDefault: true,
        run: indentMore,
      },
      {
        key: "Shift-Tab",
        preventDefault: true,
        run: indentLess,
      },
      {
        key: "Alt-ArrowLeft",
        run: cursorLineStart,
      },
      {
        key: "Alt-ArrowRight",
        run: cursorLineEnd,
      },
      {
        key: "Ctrl-Alt-/",
        run: deleteLine,
      },
      {
        key: "Ctrl-]",
        run: foldAll,
      },
      {
        key: "Ctrl-[",
        run: unfoldAll,
      },
      {
        key: "Home",
        run: cursorDocStart,
      },
      {
        key: "End",
        run: cursorDocEnd,
      },
    ];

    const userCustom = buildCustomKeymap(this.ctx.editorKeybinds.get());

    let result = mergeKeymaps(mergeKeymaps(DefaultCmKeymap, customBuiltinKeymaps), userCustom);

    if (this.ctx.customEditorKeymap()) {
      result = mergeKeymaps(result, this.ctx.customEditorKeymap()!);
    }

    return result;
  }

  reconfigureKeymap() {
    this._editor.dispatch({
      effects: this.keymapCompartment.reconfigure(keymap.of(this.keymap())),
    });
  }
}

function mergeKeymaps(
  base: ReadonlyArray<KeyBinding>,
  km: ReadonlyArray<KeyBinding>,
): Array<KeyBinding> {
  const overrideKeys = new Set(km.map((e) => e.key));
  const defaultKeymaps = base.filter((km) => {
    if (km.key && overrideKeys.has(km.key)) {
      return false;
    }
    if (km.linux && overrideKeys.has(km.linux)) {
      return false;
    }
    if (km.mac && overrideKeys.has(km.mac)) {
      return false;
    }
    if (km.win && overrideKeys.has(km.win)) {
      return false;
    }
    return true;
  });
  return [...km, ...defaultKeymaps];
}
