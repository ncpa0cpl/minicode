import { sig } from "@ncpa0cpl/vanilla-jsx/signals";
import { MiniCodeContext } from "../../context";
import { MiniCodeOptions } from "../../mini-code";
import { TabData } from "./types";
import { File } from "../../files";
import { Path } from "../../utils/path";

export class TabsContext {
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

  open(file: File) {
    const fs = this.minicode.filesystem;

    if (this.data.get().some((t) => t.file.eq(file))) {
      this.focused.dispatch(file);
      return;
    }
    fs.readFile(file.path, "utf-8").then((content) => {
      this.data.dispatch((prev) => [
        ...prev,
        { file, initialContent: content, savedContent: content, dirty: sig(false) },
      ]);
      this.focused.dispatch(file);
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

  async saveAndCloseAll() {
    const focusedIdx = this.focusedIdx;
    const fs = this.minicode.filesystem;

    const newTabs: TabData[] = [];
    for (const tab of this.data.get()) {
      if (tab.dirty.get() && tab.view) {
        try {
          const content = tab.view.state.doc.toString();
          await fs.writeFile(tab.file.path, content);
        } catch (err) {
          console.error(err);
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
    const fs = this.minicode.filesystem;
    const content = tab.view.state.doc.toString();
    await fs.writeFile(file.path, content);
    tab.savedContent = content;
    tab.dirty.dispatch(false);
  }

  updateTheme() {
    for (const tab of this.data.get()) {
      tab.view?.dispatch({
        effects: this.minicode.themes.cmExtensionsReconfigure(),
      });
    }
  }

  async refreshFile(filePath: string) {
    const tab = this.data.get().find((t) => t.file.eq(filePath));
    if (!tab || !tab.view || tab.dirty.get()) return;

    try {
      const fs = this.minicode.filesystem;
      const content = await fs.readFile(filePath, "utf-8");
      if (content === tab.view.state.doc.toString()) return;
      tab.view.dispatch({
        changes: { from: 0, to: tab.view.state.doc.length, insert: content },
      });
      tab.savedContent = content;
      tab.initialContent = content;
      tab.dirty.dispatch(false);
    } catch {
      // file may have been deleted
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
      .catch(() => {
        this.data.dispatch((prev) => prev.filter((t) => !t.file.eq(filePath)));
      });
  }

  renameTab(oldPath: string, newFile: File) {
    this.data.dispatch((tabs) => {
      const idx = tabs.findIndex((t) => t.file.eq(oldPath));
      if (idx < 0) {
        return tabs;
      }

      const oldFile = tabs[idx]!.file;

      tabs = tabs.slice();
      tabs[idx] = {
        ...tabs[idx]!,
        file: newFile,
      };

      if (oldFile.ext !== newFile.ext) {
        tabs[idx]!.view?.dispatch({
          effects: [
            this.minicode.cmLanguageReconfigure(newFile),
            this.minicode.lsp.cmReconfigure(newFile),
          ],
        });
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
