import { sig, type Signal } from "@ncpa0cpl/vanilla-jsx/signals";
import { Compartment, Extension } from "@codemirror/state";
import { File } from "./files";
import {
  Filesystem,
  LanguageConfig,
  MiniCodeOptions,
  type Dirent,
  type Storage,
} from "./mini-code";
import { Path } from "./utils/path";
import { TerminalsContext } from "./modules/terminal/terminals";
import { TabsContext } from "./modules/tabs/tabs";
import { LspContext } from "./modules/lsp/context";
import { ThemesContext } from "./modules/theme/theme";
import { LogContext } from "./modules/log/log";
import { localSig } from "./utils/local-signal";
import { CmEditor, CmPlugin, type CustomKeybind } from "./utils/cm-ext";
import { FormatterContext } from "./modules/formatter/context";
import { KeymapContext } from "./modules/keymap/keymap";

export class MiniCodeContext {
  static storageKeys = {
    theme: "minicode:theme",
    terminalVisible: "minicode:terminal-visible",
    fileTreeWidth: "minicode:file-tree-width",
    terminalHeight: "minicode:terminal-height",
    mainFontSize: "minicode:main-font-size",
    editorFontSize: "minicode:editor-font-size",
    termFontSize: "minicode:terminal-font-size",
    editorKeybinds: "minicode:editor-keybinds",
  } as const;

  uiFontSize;
  settingsOpen = sig(false);
  fileTreeVisible = sig(true);

  rootPath: string;
  root!: File;
  filesystem: Filesystem;
  abort = new AbortController();
  shadowRoot!: ShadowRoot;
  elem!: HTMLDivElement;
  private languageCompartment = new Compartment();
  fileTreeWidth: Signal<number>;
  storage: Storage;
  terminals: TerminalsContext;
  themes: ThemesContext;
  tabs: TabsContext;
  lsp: LspContext;
  logs: LogContext;
  formatter: FormatterContext;
  keymap: KeymapContext;
  editorKeybinds: Signal<CustomKeybind[]>;

  languageConfigs: Record<string, LanguageConfig> = {};

  constructor(private opts: MiniCodeOptions) {
    this.mapLangConfigs(opts.languages ?? []);

    this.rootPath = opts.root;
    this.filesystem = opts.filesystem;
    this.storage = opts.storage ?? localStorage;

    this.logs = new LogContext(this, opts);
    this.terminals = new TerminalsContext(this, opts);
    this.tabs = new TabsContext(this, opts);
    this.lsp = new LspContext(this, opts);
    this.themes = new ThemesContext(this, opts);
    this.formatter = new FormatterContext(this, opts);
    this.keymap = new KeymapContext(this, opts);

    this.fileTreeWidth = localSig(this.storage, MiniCodeContext.storageKeys.fileTreeWidth, 360);
    this.uiFontSize = localSig<string>(
      this.storage,
      MiniCodeContext.storageKeys.mainFontSize,
      "18px",
    );
    this.editorKeybinds = localSig<CustomKeybind[]>(
      this.storage,
      MiniCodeContext.storageKeys.editorKeybinds,
      [],
    );
    this.editorKeybinds.add(() => {
      this.tabs.data.get().forEach((tab) => {
        tab.cme?.reconfigureKeymap();
      });
    });
  }

  toggleFileTree() {
    this.fileTreeVisible.dispatch((v) => !v);
  }

  private mapLangConfigs(configs: LanguageConfig[]) {
    for (const conf of configs) {
      for (const ext of conf.ext) {
        this.languageConfigs[ext] = conf;
        if (ext.startsWith(".")) {
          this.languageConfigs[ext.substring(1)] = conf;
        } else {
          this.languageConfigs["." + ext] = conf;
        }
      }
    }
  }

  private specCache = new WeakMap<Function, Extension | Promise<Extension>>();
  getLanguageExtensions(file: File) {
    if (!file.ext) return undefined;

    const config = this.languageConfigs[file.ext];
    if (!config || !config.spec) return undefined;

    if (typeof config.spec === "function") {
      const cached = this.specCache.get(config.spec);
      if (cached) {
        return cached;
      }
      const s = config.spec();
      this.specCache.set(config.spec, s);
      return s;
    }

    return config.spec;
  }

  registerPlugins(cm: CmEditor, file: File) {
    const specPlugin = cm.addPlugin("syntax-spec");
    this.updateLangSpecPlugin(file, specPlugin);

    this.lsp.registerPlugins(cm, file);
    this.themes.registerPlugins(cm, file);
  }

  updatePlugins(cm: CmEditor, file: File) {
    const specPlugin = cm.getOrAddPlugin("syntax-spec");
    this.updateLangSpecPlugin(file, specPlugin);

    this.lsp.updatePlugins(cm, file);
    this.themes.updatePlugins(cm, file);
  }

  private updateLangSpecPlugin(file: File, plugin: CmPlugin) {
    const cmExt = this.getLanguageExtensions(file);
    if (cmExt && !(cmExt instanceof Promise)) {
      plugin.replace(cmExt);
      return;
    }

    // remove the current ext
    plugin.replace();

    if (cmExt) {
      cmExt
        .then((cmExt) => {
          plugin.replace(cmExt);
        })
        .catch((err) => {
          this.logs.error("Failed to load the language extension", err);
        });
    }
  }

  async load() {
    this.logs.info(`Loading workspace "${this.opts.root}"`);
    this.root = await this.loadDirShallow(this.opts.root);
    this.logs.debug("Workspace loaded, starting filesystem watch");
    const watchEvents = this.filesystem.watch(this.root.path, {
      recursive: true,
      signal: this.abort.signal,
    });

    (async () => {
      try {
        for await (const event of watchEvents) {
          if (!event.filename) continue;
          this.logs.debug(`FS watch: ${event.eventType} "${event.filename}"`);
          const fullPath = Path.from(this.root.path).join(event.filename);
          const parentPath = fullPath.dir();

          if (event.eventType === "rename") {
            await this.refreshDir(parentPath.toString());
            this.tabs.checkDeletedFile(fullPath.toString());
          } else if (event.eventType === "change") {
            await this.tabs.refreshFile(fullPath.toString());
          }

          this.lsp.onFileChange(event.filename, event.eventType);
        }
      } catch (err) {
        if (Error.isError(err) && err.name === "AbortError") {
          return;
        }
        this.logs.error("Filesystem watch error", err);
      }
    })();
  }

  async loadSingleFile(file: string | Path) {
    const filepath = Path.from(file);

    this.logs.info(`Loading file "${file}"`);
    const sf = new File(filepath, false);
    this.root = new File(filepath.dir(), true, [sf]);
    const tab = await this.tabs.open(sf);

    if (tab) {
      const cm = new CmEditor(
        this,
        tab.initialContent,
        (docStr) => {
          tab.dirty.dispatch(docStr !== tab.savedContent);
        },
        8,
      );

      tab.cme = cm;
      tab.view = cm.editor();

      this.registerPlugins(cm, tab.file);
    }

    this.logs.debug("Single file loaded");

    return tab;
  }

  /**
   * Reads a single directory and creates lazy File entries for its children.
   * Subdirectories are created with a loadFn that calls back into this method
   * — they are not loaded until accessed.
   */
  private async loadDirShallow(
    filepath: string | Path,
    preloadSubdirectories = true,
  ): Promise<File> {
    const dirpath = Path.from(filepath);
    const entries = await this.filesystem.readdir(filepath.toString(), { withFileTypes: true });

    const children = await Promise.all(
      entries.map(async (e) => {
        const childPath = dirpath.join(e.name);
        if (e.isDirectory()) {
          const f = new File(childPath, true, undefined, () =>
            this.loadDirShallow(childPath, false),
          );
          if (preloadSubdirectories) {
            await f.children();
          }
          return f;
        }
        return new File(childPath, false);
      }),
    );

    return new File(dirpath, true, children);
  }

  async refreshDir(dirPath: string) {
    const dir = this.findLoadedFile(dirPath);
    if (!dir || !dir.isDir || dir.isLoading?.get() || !dir.isLoaded?.get()) return;

    let entries: Dirent[];
    try {
      entries = await this.filesystem.readdir(dirPath, { withFileTypes: true });
    } catch (err) {
      this.logs.error(`Failed to read directory "${dirPath}"`, err);
      return;
    }

    const currentChildren = new Map<string, Signal<File>>();
    for (const childSig of dir.files().get()) {
      const child = childSig.get();
      currentChildren.set(child.name, childSig);
    }

    const dirpath = Path.from(dirPath);
    const newChildren: Signal<File>[] = [];

    for (const entry of entries) {
      const childPath = dirpath.join(entry.name);
      const existingSig = currentChildren.get(entry.name);

      if (existingSig && existingSig.get().isDir && entry.isDirectory()) {
        // is a directory, did not change
        newChildren.push(existingSig);
      } else if (existingSig && !existingSig.get().isDir && !entry.isDirectory()) {
        // is a file, did not change
        newChildren.push(existingSig);
      } else if (existingSig && !existingSig.get().isDir && entry.isDirectory()) {
        // is a directory, was a file before
        newChildren.push(
          sig(new File(childPath, true, undefined, () => this.loadDirShallow(childPath))),
        );
      } else if (existingSig && existingSig.get().isDir && !entry.isDirectory()) {
        // is a file, was a dir before
        newChildren.push(sig(new File(childPath, false)));
      } else if (!existingSig && entry.isDirectory()) {
        // is a directory, didn't exist before
        newChildren.push(
          sig(new File(childPath, true, undefined, () => this.loadDirShallow(childPath))),
        );
      } else if (!existingSig && !entry.isDirectory()) {
        // is a file, didn't exist before
        newChildren.push(sig(new File(childPath, false)));
      }
    }

    dir.replaceFiles(newChildren);
  }

  async createFile(dirPath: string, name: string) {
    try {
      const newFilePath = Path.from(dirPath).join(name);
      const filePath = newFilePath.toString();
      this.logs.debug(`Creating file "${filePath}"`);
      await this.filesystem.writeFile(filePath, "");
      await this.refreshDir(dirPath);

      const parentDir = this.findLoadedFile(newFilePath.dir());
      if (parentDir) {
        parentDir.expanded.dispatch(true);
      }
      const newFile = this.findLoadedFile(newFilePath);
      if (newFile) {
        this.tabs.open(newFile);
      }

      this.lsp.onFileChange(filePath, "created");
    } catch (err) {
      this.logs.error(`Failed to create file "${name}"`, err);
    }
  }

  async createDirectory(dirPath: string, name: string) {
    try {
      const newDirPath = Path.from(dirPath).join(name);
      const dirPathFull = newDirPath.toString();
      this.logs.debug(`Creating directory "${dirPathFull}"`);
      await this.filesystem.mkdir(dirPathFull);
      await this.refreshDir(dirPath);

      const parentDir = this.findLoadedFile(newDirPath.dir());
      if (parentDir) {
        parentDir.expanded.dispatch(true);
      }
    } catch (err) {
      this.logs.error(`Failed to create directory "${name}"`, err);
    }
  }

  findLoadedFile(path: string | Path) {
    path = Path.from(path);

    let searchFile = this.root;

    const relPath = path.relative(this.root.path, false);
    for (const seg of relPath.segments()) {
      if (seg === ".." || !searchFile.isDir) {
        return undefined;
      }

      const chidlren = searchFile.loadedChildren();
      const matching = chidlren.find((f) => f.get().name === seg);

      if (!matching) {
        return undefined;
      }

      searchFile = matching.get();
    }

    return searchFile;
  }

  async findFile(path: string | Path) {
    path = Path.from(path);

    let searchFile = this.root;

    const relPath = path.relative(this.root.path, false);
    for (const seg of relPath.segments()) {
      if (seg === ".." || !searchFile.isDir) {
        return undefined;
      }

      const chidlren = await searchFile.children();
      const matching = chidlren.find((f) => f.get().name === seg);

      if (!matching) {
        return undefined;
      }

      searchFile = matching.get();
    }

    return searchFile;
  }

  async renamePath(file: File, newName: string) {
    try {
      const oldPath = file.path;
      const newPath = Path.from(oldPath).dir().join(newName).toString();
      this.logs.debug(`Renaming "${oldPath}" -> "${newPath}"`);
      await this.filesystem.rename(oldPath, newPath);

      this.tabs.renameTab(oldPath, file.rename(newPath));
      await this.refreshDir(Path.from(oldPath).dir().toString());

      this.lsp.onFileChange(oldPath, "deleted");
      this.lsp.onFileChange(newPath, "created");
    } catch (err) {
      this.logs.error(`Failed to rename "${file.path}" -> "${newName}"`, err);
    }
  }

  async deletePath(file: File) {
    try {
      const path = file.path;
      const isDir = file.isDir;
      this.logs.debug(`Deleting "${path}"${isDir ? " (directory)" : ""}`);
      await this.filesystem.rm(path, { recursive: isDir, force: true });
      this.tabs.close(file);
      await this.refreshDir(Path.from(path).dir().toString());
      this.lsp.onFileChange(path, "deleted");
    } catch (err) {
      this.logs.error(`Failed to delete "${file.path}"`, err);
    }
  }

  async copyPathTo(srcFile: File, destDir: string) {
    try {
      const srcPath = srcFile.path;
      const name = srcFile.name;
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
        } catch (err) {
          this.logs.debug("copyPathTo destination check failed", err);
          break;
        }
        const baseName = Path.from(destPath).basename(false);
        const ext = Path.from(destPath).ext();
        const suffix = ext ? `.${ext}` : "";
        finalDest = Path.from(destDir).join(`${baseName} ${i}${suffix}`).toString();
        i++;
      }
      this.logs.debug(`Copying "${srcPath}" -> "${finalDest}"`);
      await this.filesystem.copyFile(srcPath, finalDest);
      await this.refreshDir(destDir);

      this.lsp.onFileChange(destDir, "created");
    } catch (err) {
      this.logs.error(`Failed to copy "${srcFile.path}" to "${destDir}"`, err);
    }
  }

  async movePathTo(srcFile: File, destDir: string) {
    try {
      const srcPath = srcFile.path;
      const name = srcFile.name;
      const destPath = Path.from(destDir).join(name).toString();
      this.logs.debug(`Moving "${srcPath}" -> "${destPath}"`);
      await this.filesystem.rename(srcPath, destPath);

      this.tabs.renameTab(srcPath, srcFile.rename(destPath));

      await this.refreshDir(destDir);
      await this.refreshDir(Path.from(srcPath).dir().toString());

      this.lsp.onFileChange(srcPath, "deleted");
      this.lsp.onFileChange(destPath, "created");
    } catch (err) {
      this.logs.error(`Failed to move "${srcFile.path}" to "${destDir}"`, err);
    }
  }

  async expandAll(path: string | Path) {
    path = Path.from(path);

    let searchFile = this.root;

    const relPath = path.relative(this.root.path, false);
    for (const seg of relPath.segments()) {
      if (seg === ".." || !searchFile.isDir) {
        return undefined;
      }

      const chidlren = await searchFile.children();
      const matching = chidlren.find((f) => f.get().name === seg);

      if (!matching) {
        return undefined;
      }

      if (matching.get().isDir) {
        matching.get().expanded.dispatch(true);
      }
      searchFile = matching.get();
    }

    return searchFile;
  }

  titlebarCustomLeftButtons() {
    return this.opts.titleBarButtons?.filter((b) => b.position === "left") ?? [];
  }

  titlebarCustomRightButtons() {
    return this.opts.titleBarButtons?.filter((b) => b.position === "right") ?? [];
  }

  customEditorKeymap() {
    return this.opts.keymaps?.editor;
  }

  addEditorKeybind(key: string, command: string) {
    const current = this.editorKeybinds.get();
    const filtered = current.filter((kb) => kb.key !== key && kb.command !== command);
    this.editorKeybinds.dispatch([...filtered, { key, command }]);
  }

  removeEditorKeybind(index: number) {
    const current = this.editorKeybinds.get();
    this.editorKeybinds.dispatch(current.filter((_, i) => i !== index));
  }

  dispose() {
    this.terminals.data.get().forEach((t) => this.terminals.close(t.id));
    this.lsp.terminate();
  }
}
