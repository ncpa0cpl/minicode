import { sig, type Signal } from "@ncpa0cpl/vanilla-jsx/signals";
import { File } from "./files";
import { Filesystem, MiniCodeOptions, type Dirent } from "./mini-code";
import { Path } from "./utils/path";
import { EditorView } from "codemirror";
import { Compartment } from "@codemirror/state";
import type { HighlightStyle } from "@codemirror/language";
import {
  darkTheme,
  defineCodeMirrorTheme,
  defineSyntaxHighlighting,
  gnomeDarkTheme,
  gnomeLightTheme,
  lightTheme,
  type Theme,
  type ThemeInput,
} from "./themes";
import { LspManager } from "./lsp/manager";
import { toUri } from "./lsp/types";
import { resolveLanguageExtension, type LanguagesConfig } from "./languages";
import { createLspExtensions } from "./lsp/extensions";
import type { TerminalBackend, TerminalFactory } from "./terminal/types";

export type TabData = {
  file: File;
  initialContent: string;
  savedContent: string;
  dirty: Signal<boolean>;
  view?: EditorView;
};

export type TerminalTabData = {
  id: number;
  backend: TerminalBackend;
  termEl: HTMLElement;
  fit: () => void;
  setTheme: (theme: Record<string, string>) => void;
  cleanup: () => void;
};

export class MiniCodeContext {
  root!: File;
  filesystem: Filesystem;
  abort = new AbortController();
  opendTabs = sig<TabData[]>([]);
  focusedTab = sig<File>();
  theme;
  themeCompartment = new Compartment();
  syntaxCompartment = new Compartment();
  lspCompartment = new Compartment();
  private syntaxOverride: HighlightStyle | undefined;
  shadowRoot!: ShadowRoot;
  lspManager: LspManager;
  private languages: LanguagesConfig | undefined;
  availableThemes: Theme[] = [];
  private dirIndex = new Map<string, File>();
  terminals = sig<TerminalTabData[]>([]);
  terminalVisible = sig(false);
  private terminalFactory: TerminalFactory | undefined;
  private nextTerminalId = 0;

  constructor(private opts: MiniCodeOptions) {
    this.filesystem = opts.filesystem;
    this.languages = opts.languages;
    this.syntaxOverride = opts.syntaxTheme;
    this.terminalFactory = opts.terminal;
    this.availableThemes = (opts.themes ?? []).concat([
      darkTheme,
      lightTheme,
      gnomeDarkTheme,
      gnomeLightTheme,
    ]);
    this.theme = sig<Theme>(this.resolveTheme(opts.theme));
    if (!this.availableThemes.some((t) => t.name === this.theme.get().name)) {
      this.availableThemes.unshift(this.theme.get());
    }
    this.lspManager = new LspManager(opts.lsp ?? {}, toUri(opts.root));
  }

  resolveTheme(name?: string | Theme) {
    if (typeof name === "string")
      return this.availableThemes.find((t) => t.name === name) ?? darkTheme;
    return name ?? darkTheme;
  }

  getLanguageExtensions(file: File) {
    return resolveLanguageExtension(this.languages, file.ext);
  }

  getLspExtensions(file: File) {
    return createLspExtensions(this.lspManager, file);
  }

  getSyntaxExtension() {
    const theme = this.theme.get();
    const style = this.syntaxOverride ?? theme.syntax;
    return defineSyntaxHighlighting({ ...theme, syntax: style });
  }

  setTheme(input: ThemeInput) {
    const next = this.resolveTheme(input);
    this.theme.dispatch(next);
    const xtermTheme = this.getXtermTheme();
    for (const tab of this.opendTabs.get()) {
      tab.view?.dispatch({
        effects: [
          this.themeCompartment.reconfigure(defineCodeMirrorTheme(next)),
          this.syntaxCompartment.reconfigure(this.getSyntaxExtension()),
        ],
      });
    }
    for (const term of this.terminals.get()) {
      term.setTheme(xtermTheme);
    }
  }

  setSyntaxTheme(style: HighlightStyle | undefined) {
    this.syntaxOverride = style;
    for (const tab of this.opendTabs.get()) {
      tab.view?.dispatch({
        effects: this.syntaxCompartment.reconfigure(this.getSyntaxExtension()),
      });
    }
  }

  async load() {
    this.root = await this.loadDir(this.opts.root);
    const watchEvents = this.filesystem.watch(this.root.path, {
      recursive: true,
      signal: this.abort.signal,
    });

    (async () => {
      for await (const event of watchEvents) {
        if (!event.filename) continue;
        const fullPath = Path.from(this.root.path).join(event.filename);
        const parentPath = fullPath.dir();

        if (event.eventType === "rename") {
          await this.refreshDir(parentPath.toString());
          this.checkDeletedFile(fullPath.toString());
        } else if (event.eventType === "change") {
          await this.refreshOpenFile(fullPath.toString());
        }
      }
    })();
  }

  private async loadDir(filepath: string | Path): Promise<File> {
    const dirpath = Path.from(filepath);
    const files = await this.filesystem.readdir(filepath.toString(), { withFileTypes: true });

    const children = await Promise.all(
      files.map((f) => {
        if (f.isDirectory()) {
          return this.loadDir(dirpath.join(f.name));
        }
        return new File(dirpath.join(f.name), false);
      }),
    );

    const dir = new File(dirpath, true, children);
    this.dirIndex.set(dirpath.toString(), dir);
    return dir;
  }

  async refreshDir(dirPath: string) {
    const dir = this.dirIndex.get(dirPath);
    if (!dir || !dir.isDir) return;

    let entries: Dirent[];
    try {
      entries = await this.filesystem.readdir(dirPath, { withFileTypes: true });
    } catch {
      return;
    }

    const currentChildren = dir.files().get();
    const existing = new Map<string, Signal<File>>();
    for (const childSig of currentChildren) {
      const child = childSig.get();
      existing.set(child.name, childSig);
    }

    const dirpath = Path.from(dirPath);
    const newChildren: Signal<File>[] = [];
    const seenDirs = new Set<string>();

    for (const entry of entries) {
      const childPath = dirpath.join(entry.name);
      if (entry.isDirectory()) {
        seenDirs.add(childPath.toString());
        const existingSig = existing.get(entry.name);
        if (existingSig) {
          newChildren.push(existingSig);
        } else {
          const newDir = await this.loadDir(childPath);
          newChildren.push(sig(newDir));
        }
      } else {
        const existingSig = existing.get(entry.name);
        if (existingSig && !existingSig.get().isDir) {
          newChildren.push(existingSig);
        } else {
          newChildren.push(sig(new File(childPath, false)));
        }
      }
    }

    for (const [name, childSig] of existing) {
      const child = childSig.get();
      if (child.isDir && !seenDirs.has(child.path)) {
        this.dirIndex.delete(child.path);
      }
      if (!newChildren.includes(childSig)) {
        existing.delete(name);
      }
    }

    dir.files().dispatch(newChildren);
  }

  private async refreshOpenFile(filePath: string) {
    const tab = this.opendTabs.get().find((t) => t.file.eq(filePath));
    if (!tab || !tab.view || tab.dirty.get()) return;

    try {
      const content = await this.filesystem.readFile(filePath, "utf-8");
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

  private checkDeletedFile(filePath: string) {
    const tab = this.opendTabs.get().find((t) => t.file.eq(filePath));
    if (!tab) return;
    this.filesystem
      .readdir(Path.from(filePath).dir().toString(), { withFileTypes: true })
      .then((entries) => {
        const exists = entries.some((e) => e.name === Path.from(filePath).basename());
        if (!exists) {
          this.opendTabs.dispatch((prev) => prev.filter((t) => !t.file.eq(filePath)));
        }
      })
      .catch(() => {
        this.opendTabs.dispatch((prev) => prev.filter((t) => !t.file.eq(filePath)));
      });
  }

  openFile(file: File) {
    if (this.opendTabs.get().some((t) => t.file.eq(file))) {
      this.focusedTab.dispatch(file);
      return;
    }
    this.filesystem.readFile(file.path, "utf-8").then((content) => {
      this.opendTabs.dispatch((prev) => [
        ...prev,
        { file, initialContent: content, savedContent: content, dirty: sig(false) },
      ]);
      this.focusedTab.dispatch(file);
    });
  }

  focusTab(file: File) {
    this.focusedTab.dispatch(file);
  }

  closeTab(file: File) {
    const tab = this.opendTabs.get().find((t) => t.file.eq(file));
    if (!tab) {
      return;
    }
    if (tab.dirty.get()) {
      const ok = confirm(`"${file.name}" has unsaved changes. Close anyway?`);
      if (!ok) {
        return;
      }
    }
    this.opendTabs.dispatch((prev) => prev.filter((t) => !t.file.eq(file)));
  }

  async saveFile(file: File) {
    const tab = this.opendTabs.get().find((t) => t.file.eq(file));
    if (!tab || !tab.view) {
      return;
    }
    const content = tab.view.state.doc.toString();
    await this.filesystem.writeFile(file.path, content);
    tab.savedContent = content;
    tab.dirty.dispatch(false);
  }

  async createFile(dirPath: string, name: string) {
    const filePath = Path.from(dirPath).join(name).toString();
    await this.filesystem.writeFile(filePath, "");
    await this.refreshDir(dirPath);
  }

  async createDirectory(dirPath: string, name: string) {
    const dirPathFull = Path.from(dirPath).join(name).toString();
    await this.filesystem.mkdir(dirPathFull);
    await this.refreshDir(dirPath);
  }

  async renamePath(oldPath: string, newName: string) {
    const oldFile = new File(oldPath, false);
    const newPath = Path.from(oldPath).dir().join(newName).toString();
    await this.filesystem.rename(oldPath, newPath);

    const tab = this.opendTabs.get().find((t) => t.file.eq(oldPath));
    if (tab) {
      tab.file = new File(newPath, false);
      this.opendTabs.dispatch((prev) => prev.slice());
      if (this.focusedTab.get()?.eq(oldFile)) {
        this.focusedTab.dispatch(tab.file);
      }
      tab.view?.dispatch({
        effects: this.lspCompartment.reconfigure(this.getLspExtensions(tab.file)),
      });
    }

    await this.refreshDir(Path.from(oldPath).dir().toString());
  }

  async deletePath(path: string) {
    const file = new File(path, false);
    const isDir = this.dirIndex.has(path);
    await this.filesystem.rm(path, { recursive: isDir, force: true });
    this.closeTab(file);
    await this.refreshDir(Path.from(path).dir().toString());
  }

  async copyPathTo(srcPath: string, destDir: string) {
    const name = Path.from(srcPath).basename();
    const destPath = Path.from(destDir).join(name).toString();
    let finalDest = destPath;
    let i = 1;
    while (true) {
      try {
        await this.filesystem.readdir(Path.from(finalDest).dir().toString());
        const entries = await this.filesystem.readdir(Path.from(finalDest).dir().toString(), {
          withFileTypes: true,
        });
        if (!entries.some((e) => e.name === Path.from(finalDest).basename())) {
          break;
        }
      } catch {
        break;
      }
      const baseName = Path.from(destPath).basename(false);
      const ext = Path.from(destPath).ext();
      const suffix = ext ? `.${ext}` : "";
      finalDest = Path.from(destDir).join(`${baseName} ${i}${suffix}`).toString();
      i++;
    }
    await this.filesystem.copyFile(srcPath, finalDest);
    await this.refreshDir(destDir);
  }

  async movePathTo(srcPath: string, destDir: string) {
    const name = Path.from(srcPath).basename();
    const destPath = Path.from(destDir).join(name).toString();
    await this.filesystem.rename(srcPath, destPath);

    const tab = this.opendTabs.get().find((t) => t.file.eq(srcPath));
    if (tab) {
      tab.file = new File(destPath, false);
      this.opendTabs.dispatch((prev) => prev.slice());
      if (this.focusedTab.get()?.eq(srcPath)) {
        this.focusedTab.dispatch(tab.file);
      }
      tab.view?.dispatch({
        effects: this.lspCompartment.reconfigure(this.getLspExtensions(tab.file)),
      });
    }

    await this.refreshDir(destDir);
    await this.refreshDir(Path.from(srcPath).dir().toString());
  }

  hasTerminalSupport() {
    return !!this.terminalFactory;
  }

  async openTerminal() {
    if (!this.terminalFactory) return;
    const { Terminal } = await import("@xterm/xterm");
    const { FitAddon } = await import("@xterm/addon-fit");
    const term = new Terminal({
      fontSize: 13,
      fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
      theme: this.getXtermTheme(),
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    const container = document.createElement("div");
    container.style.width = "100%";
    container.style.height = "100%";
    term.open(container);

    const cols = term.cols;
    const rows = term.rows;
    const backend = this.terminalFactory({ cols, rows });

    const onDataDispose = term.onData((data) => backend.write(data));
    const onBackendDataDispose = backend.onData((data) => term.write(data));
    const onResizeDispose = term.onResize(({ cols, rows }) => backend.resize(cols, rows));

    const id = this.nextTerminalId++;
    const tabData: TerminalTabData = {
      id,
      backend,
      termEl: container,
      fit: () => fitAddon.fit(),
      setTheme: (theme) => {
        term.options.theme = theme;
      },
      cleanup: () => {
        onDataDispose.dispose();
        onBackendDataDispose();
        onResizeDispose.dispose();
        backend.dispose();
        term.dispose();
      },
    };

    this.terminals.dispatch((prev) => [...prev, tabData]);
    this.terminalVisible.dispatch(true);

    requestAnimationFrame(() => fitAddon.fit());
  }

  closeTerminal(id: number) {
    const tab = this.terminals.get().find((t) => t.id === id);
    if (tab) tab.cleanup();
    this.terminals.dispatch((prev) => prev.filter((t) => t.id !== id));
    if (this.terminals.get().length === 0) {
      this.terminalVisible.dispatch(false);
    }
  }

  toggleTerminal() {
    if (this.terminalVisible.get()) {
      this.terminalVisible.dispatch(false);
    } else if (this.terminals.get().length > 0) {
      this.terminalVisible.dispatch(true);
    } else {
      this.openTerminal();
    }
  }

  private getXtermTheme() {
    const t = this.theme.get();
    return {
      background: t.editorBg,
      foreground: t.editorFg,
      cursor: t.cursor,
      selectionBackground: t.selection,
      black: t.fg,
      red: "#e06c75",
      green: "#98c379",
      yellow: "#e5c07b",
      blue: "#61afef",
      magenta: "#c678dd",
      cyan: "#56b6c2",
      white: t.fg,
      brightBlack: t.muted,
      brightRed: "#e06c75",
      brightGreen: "#98c379",
      brightYellow: "#e5c07b",
      brightBlue: "#61afef",
      brightMagenta: "#c678dd",
      brightCyan: "#56b6c2",
      brightWhite: t.fg,
    };
  }
}
