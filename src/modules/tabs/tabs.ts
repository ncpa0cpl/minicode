import { sig } from "@ncpa0cpl/vanilla-jsx/signals";
import { MiniCodeContext } from "../../context";
import { MiniCodeOptions } from "../../mini-code";
import { TabData } from "./types";
import { File } from "../../files";
import { Path } from "../../utils/path";
import { EditorView } from "codemirror";
import { EditorSelection, StateEffect } from "@codemirror/state";
import { localSig } from "../../utils/local-signal";
import { foldable, foldedRanges, foldEffect } from "@codemirror/language";
import { CmEditor } from "../../utils/cm-ext";
import { allDiagnostics } from "../../utils/extensions/minicode-lint-marks";
import {
  Diagnostic,
  diagnosticsFromViewUpdate,
} from "../../utils/extensions/minicode-lint-diagnostics";

/**
 * Detects whether a buffer contains binary data by checking for null bytes
 * in the first 8 KB. Text files do not contain null bytes; binary files
 * almost always do within the first few hundred bytes. This is the same
 * heuristic used by gedit, VS Code, and other editors.
 */
const BINARY_SAMPLE_SIZE = 8192;

function isBinaryBuffer(buffer: Uint8Array): boolean {
  const len = Math.min(buffer.length, BINARY_SAMPLE_SIZE);
  for (let i = 0; i < len; i++) {
    if (buffer[i] === 0) return true;
  }
  return false;
}

export class TabsContext {
  fontSize;
  data = sig<TabData[]>([]);
  focused = sig<File>();

  constructor(
    private readonly minicode: MiniCodeContext,
    private opts: MiniCodeOptions,
  ) {
    this.fontSize = localSig<string>(
      this.minicode.storage,
      MiniCodeContext.storageKeys.editorFontSize,
      "1em",
    );
  }

  private get focusedIdx() {
    const f = this.focused.get();
    if (!f) return undefined;
    return this.data.get().findIndex((t) => t.file.eq(f));
  }

  private focusNext(prevIdx?: number) {
    if (this.data.get().length === 0 || prevIdx == null) return;
    if (prevIdx != 0 && this.data.get().length > 1) {
      prevIdx -= 1;
    }
    prevIdx = Math.min(this.data.get().length - 1, prevIdx);
    const ft = this.data.get()[prevIdx];
    if (ft) this.focused.dispatch(ft.file);
  }

  open(file: File): TabData | Promise<TabData | null> | null {
    const fs = this.minicode.filesystem;

    const tab = this.data.get().find((t) => t.file.eq(file));
    if (tab) {
      this.focused.dispatch(file);
      return tab;
    }

    this.minicode.logs.debug(`Opening file "${file.path}"`);
    return fs
      .readFile(file.path)
      .then((buffer) => {
        if (isBinaryBuffer(buffer)) {
          this.minicode.logs.error(`Cannot open binary file "${file.name}"`);
          return null;
        }

        const dirty = sig(false);

        const content = new TextDecoder().decode(buffer);

        const cm = new CmEditor(
          this.minicode,
          content,
          (docStr) => {
            dirty.dispatch(docStr !== newTab.savedContent);
          },
          8,
        );

        this.minicode.registerPlugins(cm, file);
        const editor = cm.editor();
        const diagnostics = sig<readonly Diagnostic[]>(allDiagnostics(editor.state));

        const removeListener = cm.onUpdate((update) => {
          const d = diagnosticsFromViewUpdate(update);
          if (d != null) diagnostics.dispatch(d);
        });

        let newTab: TabData = {
          file,
          initialContent: content,
          savedContent: content,
          dirty: dirty,
          cme: cm,
          view: editor,
          diagnostics,
          dispose() {
            removeListener();
            editor.destroy();
          },
        };

        this.data.dispatch((prev) => {
          return [...prev, newTab];
        });
        this.focused.dispatch(file);

        return newTab;
      })
      .catch((err) => {
        this.minicode.logs.error(`Failed to open file "${file.path}"`, err);
        return null;
      });
  }

  focus(file: File) {
    this.focused.dispatch(file);
    const focusedTab = this.data.get().find((tab) => tab.file.eq(file));
    focusedTab?.view.focus();
  }

  close(file: File) {
    const focusedIdx = this.focusedIdx;
    const tab = this.data.get().find((t) => t.file.eq(file));
    if (!tab) {
      return;
    }
    if (tab.dirty.get()) {
      const ok = confirm(`"${file.name}" has unsaved changes. Close anyway?`);
      if (!ok) {
        return;
      }
    }
    this.minicode.logs.debug(`Closing tab "${file.path}"`);
    this.data.dispatch((prev) => prev.filter((t) => !t.file.eq(file)));
    this.focusNext(focusedIdx);
    tab.dispose();
  }

  closeAll() {
    const focusedIdx = this.focusedIdx;
    const newTabs: TabData[] = [];
    for (const tab of this.data.get()) {
      if (tab.dirty.get()) {
        const ok = confirm(`"${tab.file.name}" has unsaved changes. Close anyway?`);
        if (!ok) {
          newTabs.push(tab);
          continue;
        }
      }
      tab.dispose();
    }
    this.data.dispatch(newTabs);
    this.focusNext(focusedIdx);
  }

  closeOthers(file: File) {
    const focusedIdx = this.focusedIdx;
    const newTabs: TabData[] = [];
    for (const tab of this.data.get()) {
      if (tab.file.eq(file)) {
        newTabs.push(tab);
        continue;
      }

      if (tab.dirty.get()) {
        const ok = confirm(`"${tab.file.name}" has unsaved changes. Close anyway?`);
        if (!ok) {
          newTabs.push(tab);
          continue;
        }
      }

      tab.dispose();
    }
    this.data.dispatch(newTabs);
    this.focusNext(focusedIdx);
  }

  closeClean() {
    const focusedIdx = this.focusedIdx;
    this.data.dispatch((t) => {
      const newTabs: TabData[] = [];
      for (const tab of t) {
        if (tab.dirty.get()) {
          newTabs.push(tab);
        } else {
          tab.dispose();
        }
      }
      return newTabs;
    });
    this.focusNext(focusedIdx);
  }

  async formatContent(file: File) {
    const tab = this.data.get().find((t) => t.file.eq(file));
    if (!tab || !tab.view) {
      return;
    }
    try {
      let content = tab.view.state.doc.toString();
      await this.minicode.formatter.format(tab.view, tab.file, content);
    } catch (err) {
      this.minicode.logs.error(`Failed to format file "${tab.file.path}"`, err);
    }
  }

  async saveAndCloseAll() {
    const focusedIdx = this.focusedIdx;
    const fs = this.minicode.filesystem;

    const newTabs: TabData[] = [];
    for (const tab of this.data.get()) {
      if (tab.dirty.get() && tab.view) {
        try {
          let content = tab.view.state.doc.toString();
          if (this.minicode.formatter.formatsOnSave(tab.file)) {
            content = await this.minicode.formatter.format(tab.view, tab.file, content);
          }
          this.minicode.logs.debug(`Saving file "${tab.file.path}" (${content.length} bytes)`);
          await fs.writeFile(tab.file.path, content);
          this.minicode.lsp.onFileChange(tab.file.path, "change");
          tab.dispose();
        } catch (err) {
          this.minicode.logs.error(`Failed to save file "${tab.file.path}"`, err);
          newTabs.push(tab);
        }
      }
    }
    this.data.dispatch(newTabs);
    this.focusNext(focusedIdx);
  }

  async save(file: File) {
    const tab = this.data.get().find((t) => t.file.eq(file));
    if (!tab) {
      return;
    }
    try {
      const fs = this.minicode.filesystem;
      let content = tab.view.state.doc.toString();
      if (this.minicode.formatter.formatsOnSave(file)) {
        content = await this.minicode.formatter.format(tab.view, file, content);
      }
      this.minicode.logs.debug(`Saving file "${file.path}" (${content.length} bytes)`);
      await fs.writeFile(file.path, content);
      tab.savedContent = content;
      tab.dirty.dispatch(false);
      this.minicode.lsp.onFileChange(file.path, "change");
    } catch (err) {
      this.minicode.logs.error(`Failed to save file "${file.path}"`, err);
    }
  }

  updateTheme() {
    for (const tab of this.data.get()) {
      if (tab.cme) {
        this.minicode.themes.updatePlugins(tab.cme, tab.file);
      }
    }
  }

  replaceEditorText(view: EditorView, contents: string) {
    const oldState = view.state;
    const oldDoc = oldState.doc;

    const scrollTop = view.scrollDOM.scrollTop;
    const scrollLeft = view.scrollDOM.scrollLeft;

    // Anchor the scroll position to the topmost visible line, so that
    // changes to the content above the viewport (added/removed lines,
    // restored folds) don't shift what ends up on screen.
    const topBlock = view.lineBlockAtHeight(scrollTop);
    const topLine = oldDoc.lineAt(topBlock.from);
    const topOffset = scrollTop - topBlock.top;

    // Preserve cursor by line/column
    const mainRange = oldState.selection.main;
    const oldLine = oldDoc.lineAt(mainRange.head);
    const col = mainRange.head - oldLine.from;

    const oldFoldLines: [no: number, text: string][] = [];
    foldedRanges(oldState).between(0, oldDoc.length, (from) => {
      const line = oldState.doc.lineAt(from);
      oldFoldLines.push([line.number, line.text]);
    });

    view.dispatch({
      changes: { from: 0, to: oldDoc.length, insert: contents },
    });

    const newDoc = view.state.doc;

    const findLineByNumber = (lineNo: number, text: string) => {
      const direct = newDoc.line(Math.min(lineNo, newDoc.lines));
      if (direct.text.trim() === text.trim()) return direct;

      const searchStart = Math.max(1, lineNo - 5);
      const searchEnd = Math.min(newDoc.lines, lineNo + 5);
      for (let i = searchStart; i <= searchEnd; i++) {
        const line = newDoc.line(i);
        if (line.text.trim() === text.trim()) return line;
      }
      return null;
    };

    const cursorLine =
      findLineByNumber(oldLine.number, oldLine.text) ??
      newDoc.line(Math.min(oldLine.number, newDoc.lines));
    let newCursorPos = Math.min(cursorLine.from + col, cursorLine.to);

    const foldEffects: [line: number, effect: StateEffect<any>][] = [];
    for (const [lineNo, lineText] of oldFoldLines) {
      const line = findLineByNumber(lineNo, lineText.trim());
      if (!line) continue;
      const range = foldable(view.state, line.from, line.to);
      if (range) {
        foldEffects.push([line.number, foldEffect.of(range)]);
      }
    }

    // A transaction that sets a selection clears any folded range the new
    // selection head lands strictly inside of (foldState in @codemirror/language),
    // so the cursor has to be moved out of the restored fold ranges,
    // otherwise the folds are removed by the same transaction that adds them.
    for (const [, effect] of foldEffects) {
      const range = effect.value as { from: number; to: number };
      if (newCursorPos > range.from && newCursorPos < range.to) {
        newCursorPos = view.state.doc.lineAt(range.from).from;
      }
    }

    const anchorLine =
      findLineByNumber(topLine.number, topLine.text) ??
      newDoc.line(Math.min(topLine.number, newDoc.lines));

    const effects = foldEffects.sort(([noA], [noB]) => noA - noB).map(([, effect]) => effect);
    view.dispatch({
      selection: EditorSelection.cursor(newCursorPos),
      effects: [
        ...effects,
        // Restoring the scroll position by writing to scrollDOM.scrollTop
        // right after dispatch does not work, because the geometry of the
        // new document (including restored fold widgets) is only measured
        // in the following animation frame. A scrollIntoView effect is
        // resolved after that measurement, so the anchor line ends up at
        // exactly the same offset from the top of the viewport as before.
        // Note the inverted sign: for y: "start" the effect resolves to
        // scrollTop = lineTop - yMargin, while topOffset is defined as
        // scrollTop - lineTop (the part of the line hidden above the
        // viewport edge), so the margin has to be its negation.
        EditorView.scrollIntoView(anchorLine.from, { y: "start", yMargin: -topOffset }),
      ],
    });

    // Best-effort synchronous approximation to reduce flicker before the
    // effect above is resolved with the measured geometry.
    const anchorBlock = view.lineBlockAt(anchorLine.from);
    view.scrollDOM.scrollTop = anchorBlock.top + topOffset;
    view.scrollDOM.scrollLeft = scrollLeft;
  }

  async refreshFile(filePath: string) {
    const tab = this.data.get().find((t) => t.file.eq(filePath));
    if (!tab || !tab.view || tab.dirty.get()) return;

    try {
      const fs = this.minicode.filesystem;
      const content = await fs.readFile(filePath, "utf-8");
      if (content === tab.view.state.doc.toString()) return;

      this.replaceEditorText(tab.view, content);

      tab.savedContent = content;
      tab.initialContent = content;
      tab.dirty.dispatch(false);
    } catch (err) {
      // file may have been deleted
      this.minicode.logs.debug(`Failed to refresh file "${filePath}"`, err);
    }
  }

  checkDeletedFile(filePath: string) {
    const tab = this.data.get().find((t) => t.file.eq(filePath));
    if (!tab) return;
    const fs = this.minicode.filesystem;
    fs.readdir(Path.from(filePath).dir().toString(), { withFileTypes: true })
      .then((entries) => {
        const exists = entries.some((e) => e.name === Path.from(filePath).basename());
        if (!exists) {
          this.data.dispatch((prev) => prev.filter((t) => !t.file.eq(filePath)));
        }
      })
      .catch((err) => {
        this.minicode.logs.debug(`File "${filePath}" no longer accessible`, err);
        this.data.dispatch((prev) => prev.filter((t) => !t.file.eq(filePath)));
      });
  }

  renameTab(oldPath: string, newFile: File) {
    this.data.dispatch((tabs) => {
      const idx = tabs.findIndex((t) => t.file.eq(oldPath));
      if (idx < 0) {
        return tabs;
      }

      tabs = tabs.slice();
      tabs[idx] = {
        ...tabs[idx]!,
        file: newFile,
      };

      if (tabs[idx]!.cme) {
        this.minicode.updatePlugins(tabs[idx]!.cme, newFile);
      }

      return tabs;
    });

    this.focused.dispatch((focused) => {
      if (focused && focused?.eq(oldPath)) {
        return newFile;
      }
      return focused;
    });
  }
}
