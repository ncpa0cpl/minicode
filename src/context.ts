import { sig } from "@ncpa0cpl/vanilla-jsx/signals";
import { File } from "./files";
import { Filesystem, MiniCodeOptions } from "./mini-code";
import { Path } from "./utils/path";
import { EditorView } from "codemirror";
import { Compartment } from "@codemirror/state";
import type { HighlightStyle } from "@codemirror/language";
import {
  defineCodeMirrorTheme,
  defineSyntaxHighlighting,
  resolveTheme,
  type Theme,
  type ThemeInput,
} from "./themes";
import { LspManager } from "./lsp/manager";
import { toUri } from "./lsp/types";
import { resolveLanguageExtension, type LanguagesConfig } from "./languages";
import { createLspExtensions } from "./lsp/extensions";

export type TabData = {
  file: File;
  initialContent: string;
  view?: EditorView;
};

export class MiniCodeContext {
  root!: File;
  filesystem: Filesystem;
  abort = new AbortController();
  opendTabs = sig<TabData[]>([]);
  focusedTab = sig<File>();
  theme = sig<Theme>(resolveTheme("dark"));
  themeCompartment = new Compartment();
  syntaxCompartment = new Compartment();
  private syntaxOverride: HighlightStyle | undefined;
  shadowRoot!: ShadowRoot;
  lspManager: LspManager;
  private languages: LanguagesConfig | undefined;

  constructor(private opts: MiniCodeOptions) {
    this.filesystem = opts.filesystem;
    this.languages = opts.languages;
    this.syntaxOverride = opts.syntaxTheme;
    this.theme = sig<Theme>(resolveTheme(opts.theme ?? "dark"));
    this.lspManager = new LspManager(opts.lsp ?? {}, toUri(opts.root));
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
    const next = resolveTheme(input);
    this.theme.dispatch(next);
    for (const tab of this.opendTabs.get()) {
      tab.view?.dispatch({
        effects: [
          this.themeCompartment.reconfigure(defineCodeMirrorTheme(next)),
          this.syntaxCompartment.reconfigure(this.getSyntaxExtension()),
        ],
      });
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
        // update tabs and file tree
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

    return new File(dirpath, true, children);
  }

  openFile(file: File) {
    if (this.opendTabs.get().some((t) => t.file.eq(file))) {
      this.focusedTab.dispatch(file);
      return;
    }
    this.filesystem.readFile(file.path, "utf-8").then((content) => {
      this.opendTabs.dispatch((prev) => [...prev, { file, initialContent: content }]);
      this.focusedTab.dispatch(file);
    });
  }

  focusTab(file: File) {
    this.focusedTab.dispatch(file);
  }

  closeTab(file: File) {
    if (!this.opendTabs.get().some((t) => t.file.eq(file))) {
      return;
    }
    this.opendTabs.dispatch((prev) => prev.filter((t) => !t.file.eq(file)));
  }
}
