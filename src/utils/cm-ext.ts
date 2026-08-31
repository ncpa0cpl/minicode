import { Compartment, EditorSelection, Extension, StateEffect } from "@codemirror/state";
import {
  highlightSpecialChars,
  KeyBinding,
  keymap,
  lineNumbers,
  ViewUpdate,
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
  cursorSubwordBackward,
  cursorSubwordForward,
  cursorSyntaxLeft,
  cursorSyntaxRight,
  cursorGroupForward,
  cursorGroupBackward,
  selectDocStart,
  selectDocEnd,
  selectLineStart,
  selectLineEnd,
  selectSubwordBackward,
  selectSubwordForward,
  selectSyntaxLeft,
  selectSyntaxRight,
  selectGroupForward,
  selectGroupBackward,
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
import {
  foldAll,
  unfoldAll,
  foldCode,
  toggleFold,
  unfoldCode,
  foldable,
  foldEffect,
  syntaxTree,
} from "@codemirror/language";
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
import { lintGutter } from "./extensions/minicode-lint-gutter";
import { lintMarks } from "./extensions/minicode-lint-marks";
import {
  LintGutterInteractable,
  showNextDiagnostic,
  showPrevDiagnostic,
} from "./extensions/minicode-gutter-interactions";
import { MinicodeLintTheme } from "./extensions/minicode-lint-theme";

const DefaultCmKeymap = [...defaultKeymap, ...searchKeymap, ...historyKeymap, ...completionKeymap];

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

  let text: string;
  if (sel.from === sel.to) {
    const line = view.state.doc.lineAt(sel.from);
    text = line.text;
  } else {
    text = view.state.sliceDoc(sel.from, sel.to);
  }

  navigator.clipboard.writeText(text).catch(() => {});
  return true;
}

function cutCommand(view: EditorView): boolean {
  const sel = view.state.selection.main;

  let text: string;
  if (sel.from === sel.to) {
    const line = view.state.doc.lineAt(sel.from);
    text = line.text;

    view.dispatch({
      changes: { from: line.from, to: line.to },
      userEvent: "input.cut",
    });
  } else {
    text = view.state.sliceDoc(sel.from, sel.to);

    view.dispatch({
      changes: { from: sel.from, to: sel.to },
      userEvent: "input.cut",
    });
  }

  navigator.clipboard.writeText(text).catch(() => {});
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

function foldAllCommand(view: EditorView): boolean {
  let moveSelectionTo: null | number = null;
  const initialSel = view.state.selection.main.to;

  const foldEffects: [line: number, effect: StateEffect<any>][] = [];
  syntaxTree(view.state).iterate({
    enter(node) {
      const range = foldable(view.state, node.from, node.to);
      if (range) {
        foldEffects.push([range.from, foldEffect.of(range)]);
        if (initialSel >= range.from && initialSel <= range.to) {
          moveSelectionTo = range.to + 1;
        }
      }
    },
  });

  const effects = foldEffects.sort(([noA], [noB]) => noA - noB).map(([, effect]) => effect);

  if (moveSelectionTo != null) {
    view.dispatch({
      selection: EditorSelection.cursor(moveSelectionTo),
      effects,
    });
  } else {
    view.dispatch({ effects });
  }

  return true;
}

export const editorCommands: EditorCommand[] = [
  { id: "clipboard.copy", label: "Copy", run: copyCommand },
  { id: "clipboard.cut", label: "Cut", run: cutCommand },
  { id: "clipboard.paste", label: "Paste", run: pasteCommand },
  { id: "fold.foldAll", label: "Fold All", run: foldAllCommand },
  { id: "fold.unfoldAll", label: "Unfold All", run: unfoldAll },
  { id: "fold.foldAllTopLevel", label: "Fold All Top Level", run: foldAll },
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
  { id: "navigate.subwordBackward", label: "Cursor to Sub Word Right", run: cursorSubwordForward },
  { id: "navigate.subwordForward", label: "Cursor to Sub Word Left", run: cursorSubwordBackward },
  { id: "navigate.syntaxRight", label: "Cursor to Syntax Right", run: cursorSyntaxRight },
  { id: "navigate.syntaxLeft", label: "Cursor to Syntax Left", run: cursorSyntaxLeft },
  { id: "navigate.wordForward", label: "Cursor to Word Right", run: cursorGroupForward },
  { id: "navigate.wordBackward", label: "Cursor to Word Left", run: cursorGroupBackward },
  { id: "editor.selectDocStart", label: "Select to Document Start", run: selectDocStart },
  { id: "editor.selectDocEnd", label: "Select to Document End", run: selectDocEnd },
  { id: "editor.selectLineStart", label: "Select to Line Start", run: selectLineStart },
  { id: "editor.selectLineEnd", label: "Select to Line End", run: selectLineEnd },
  {
    id: "editor.selectSubwordBackward",
    label: "Select to Sub Word Left",
    run: selectSubwordBackward,
  },
  {
    id: "editor.selectSubwordForward",
    label: "Select to Sub Word Right",
    run: selectSubwordForward,
  },
  { id: "editor.selectSyntaxLeft", label: "Select to Syntax Left", run: selectSyntaxLeft },
  { id: "editor.selectSyntaxRight", label: "Select to Syntax Right", run: selectSyntaxRight },
  { id: "editor.selectGroupForward", label: "Select to Word Right", run: selectGroupForward },
  { id: "editor.selectGroupBackward", label: "Select to Word Left", run: selectGroupBackward },
  { id: "navigate.moveLineDown", label: "Move Line Down", run: moveLineDown },
  { id: "navigate.moveLineUp", label: "Move Line Up", run: moveLineUp },
  { id: "lint.next_diag", label: "Show Next Diagnostic", run: showNextDiagnostic },
  { id: "lint.prev_diag", label: "Show Previous Diagnostic", run: showPrevDiagnostic },
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
  private emitter = new EventTarget();

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

        lintMarks(),
        // basic setup
        lineNumbers(),
        highlightSpecialChars(),
        history(),
        foldGutter(),
        lintGutter(),
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

        LintGutterInteractable,
        MinicodeLintTheme,
        EditorView.updateListener.of((u) => {
          if (u.docChanged) {
            this.onChange(u.state.doc.toString());
          }
          const ev = new CustomEvent("cm-update", { detail: u });
          this.emitter.dispatchEvent(ev);
        }),

        ...this.freeCompartments.map((c) => c.of([])),
      ],
    });
  }

  onUpdate(listener: (update: ViewUpdate) => void) {
    const handler = (ev: CustomEvent<ViewUpdate>) => {
      listener(ev.detail);
    };

    this.emitter.addEventListener("cm-update", handler as any);
    return () => {
      this.emitter.removeEventListener("cm-update", handler as any);
    };
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
