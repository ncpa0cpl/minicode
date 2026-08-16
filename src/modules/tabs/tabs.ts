import { sig } from "@ncpa0cpl/vanilla-jsx/signals";
import { MiniCodeContext } from "../../context";
import { MiniCodeOptions } from "../../mini-code";
import { TabData } from "./types";
import { File } from "../../files";
import { Path } from "../../utils/path";
import { EditorView } from "codemirror";
import { EditorSelection } from "@codemirror/state";

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
  fontSize = sig<string | number>("1em");
  data = sig<TabData[]>([]);
  focused = sig<File>();

  constructor(
    private readonly minicode: MiniCodeContext,
    private opts: MiniCodeOptions,
  ) {}

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

        const content = new TextDecoder().decode(buffer);
        let newTab: TabData = {
          file,
          initialContent: content,
          savedContent: content,
          dirty: sig(false),
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
  }

  closeAll() {
    const focusedIdx = this.focusedIdx;
    const newTabs: TabData[] = [];
    for (const tab of this.data.get()) {
      if (tab.dirty.get()) {
        const ok = confirm(`"${tab.file.name}" has unsaved changes. Close anyway?`);
        if (!ok) {
          newTabs.push(tab);
        }
      }
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
        }
      }
    }
    this.data.dispatch(newTabs);
    this.focusNext(focusedIdx);
  }

  closeClean() {
    const focusedIdx = this.focusedIdx;
    this.data.dispatch((t) => t.filter((t) => t.dirty.get()));
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
    if (!tab || !tab.view) {
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

    // Preserve cursor by line/column
    const mainRange = oldState.selection.main;
    const oldLine = oldDoc.lineAt(mainRange.head);
    const col = mainRange.head - oldLine.from;

    view.dispatch({
      changes: { from: 0, to: oldDoc.length, insert: contents },
    });

    const newDoc = view.state.doc;
    const lineNumber = Math.min(oldLine.number, newDoc.lines);
    const newLine = newDoc.line(lineNumber);
    const newPos = Math.min(newLine.from + col, newLine.to);

    view.dispatch({
      selection: EditorSelection.cursor(newPos),
    });

    view.scrollDOM.scrollTop = scrollTop;
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
