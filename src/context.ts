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
import { CmEditor, CmPlugin } from "./utils/cm-ext";

export class MiniCodeContext {
  static storageKeys = {
    theme: "minicode:theme",
    terminalVisible: "minicode:terminal-visible",
    fileTreeWidth: "minicode:file-tree-width",
    terminalHeight: "minicode:terminal-height",
  } as const;

  root!: File;
  filesystem: Filesystem;
  abort = new AbortController();
  shadowRoot!: ShadowRoot;
  private languageCompartment = new Compartment();
  private dirIndex = new Map<string, File>();
  fileTreeWidth: Signal<number>;
  storage: Storage;
  terminals: TerminalsContext;
  themes: ThemesContext;
  tabs: TabsContext;
  lsp: LspContext;
  logs: LogContext;

  languageConfigs: Record<string, LanguageConfig> = {};

  constructor(private opts: MiniCodeOptions) {
    this.mapLangConfigs(opts.languages ?? []);

    this.filesystem = opts.filesystem;
    this.storage = opts.storage ?? localStorage;

    this.logs = new LogContext(this, opts);
    this.terminals = new TerminalsContext(this, opts);
    this.tabs = new TabsContext(this, opts);
    this.lsp = new LspContext(this, opts);
    this.themes = new ThemesContext(this, opts);

    this.fileTreeWidth = localSig(this.storage, MiniCodeContext.storageKeys.fileTreeWidth, 360);
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
    this.root = await this.loadDir(this.opts.root);
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
    } catch (err) {
      this.logs.error(`Failed to read directory "${dirPath}"`, err);
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

    dir.replaceFiles(newChildren);
  }

  async createFile(dirPath: string, name: string) {
    try {
      const filePath = Path.from(dirPath).join(name).toString();
      this.logs.info(`Creating file "${filePath}"`);
      await this.filesystem.writeFile(filePath, "");
      await this.refreshDir(dirPath);
    } catch (err) {
      this.logs.error(`Failed to create file "${name}"`, err);
    }
  }

  async createDirectory(dirPath: string, name: string) {
    try {
      const dirPathFull = Path.from(dirPath).join(name).toString();
      this.logs.info(`Creating directory "${dirPathFull}"`);
      await this.filesystem.mkdir(dirPathFull);
      await this.refreshDir(dirPath);
    } catch (err) {
      this.logs.error(`Failed to create directory "${name}"`, err);
    }
  }

  findFile(path: string | Path) {
    path = Path.from(path);

    let searchFile = this.root;

    const relPath = path.relative(this.root.path, false);
    for (const seg of relPath.segments()) {
      if (seg === ".." || !searchFile.isDir) {
        return undefined;
      }

      const matching = searchFile
        .files()
        .get()
        .find((f) => f.get().name === seg);

      if (!matching) {
        return undefined;
      }

      searchFile = matching.get();
    }

    return searchFile;
  }

  async renamePath(oldPath: string, newName: string) {
    try {
      const oldFile = this.findFile(oldPath);
      if (!oldFile) return;

      const newPath = Path.from(oldPath).dir().join(newName).toString();
      this.logs.info(`Renaming "${oldPath}" -> "${newPath}"`);
      await this.filesystem.rename(oldPath, newPath);

      this.tabs.renameTab(oldPath, oldFile.rename(newPath));
      await this.refreshDir(Path.from(oldPath).dir().toString());
    } catch (err) {
      this.logs.error(`Failed to rename "${oldPath}" -> "${newName}"`, err);
    }
  }

  async deletePath(path: string) {
    try {
      const oldFile = this.findFile(path);
      if (!oldFile) return;

      const isDir = oldFile.isDir;
      this.logs.info(`Deleting "${path}"${isDir ? " (directory)" : ""}`);
      await this.filesystem.rm(path, { recursive: isDir, force: true });
      this.tabs.close(oldFile);
      await this.refreshDir(Path.from(path).dir().toString());
    } catch (err) {
      this.logs.error(`Failed to delete "${path}"`, err);
    }
  }

  async copyPathTo(srcPath: string, destDir: string) {
    try {
      const oldFile = this.findFile(srcPath);
      if (!oldFile) return;

      const name = oldFile.name;
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
      this.logs.info(`Copying "${srcPath}" -> "${finalDest}"`);
      await this.filesystem.copyFile(srcPath, finalDest);
      await this.refreshDir(destDir);
    } catch (err) {
      this.logs.error(`Failed to copy "${srcPath}" to "${destDir}"`, err);
    }
  }

  async movePathTo(srcPath: string, destDir: string) {
    try {
      const oldFile = this.findFile(srcPath);
      if (!oldFile) return;

      const name = oldFile.name;
      const destPath = Path.from(destDir).join(name).toString();
      this.logs.info(`Moving "${srcPath}" -> "${destPath}"`);
      await this.filesystem.rename(srcPath, destPath);

      this.tabs.renameTab(srcPath, oldFile.rename(destPath));

      await this.refreshDir(destDir);
      await this.refreshDir(Path.from(srcPath).dir().toString());
    } catch (err) {
      this.logs.error(`Failed to move "${srcPath}" to "${destDir}"`, err);
    }
  }
}
