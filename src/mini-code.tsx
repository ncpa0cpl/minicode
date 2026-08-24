import { sig } from "@ncpa0cpl/vanilla-jsx/signals";
import { FileTree } from "./components/file-tree/file-tree";
import { Tabs } from "./modules/tabs/components/tabs";
import { TerminalPanel } from "./modules/terminal/components/terminal";
import { MiniCodeContext } from "./context";
import type { LanguageSpec } from "./languages";
import type { HighlightStyle } from "@codemirror/language";
import { TerminalFactory } from "./modules/terminal/types";
import { Theme, ThemeInput, themeToCssVars } from "./modules/theme/themes";
import { LspTransportFactory } from "./modules/lsp/types";
import { FormatterFactory } from "./modules/formatter/types";
import { KeyBinding } from "@codemirror/view";
import { Path } from "./utils/path";
import { TabData } from "./modules/tabs/types";
import { MinicodeRoot } from "./components/minicode-root/minicode-root";

export type Dirent = {
  isDirectory(): boolean;
  isFile(): boolean;
  isSymbolicLink(): boolean;
  name: string;
};

export interface Filesystem {
  readdir(path: string): Promise<string[]>;
  readdir(path: string, opts: { withFileTypes: true }): Promise<Dirent[]>;
  readFile(path: string): Promise<Uint8Array>;
  readFile(path: string, encoding: "utf-8"): Promise<string>;
  writeFile(path: string, data: string): Promise<void>;
  unlink(path: string): Promise<void>;
  rename(oldPath: string, newPath: string): Promise<void>;
  copyFile(src: string, dest: string): Promise<void>;
  rm(path: string, opts?: { recursive?: boolean; force?: boolean }): Promise<void>;
  mkdir(path: string, opts?: { recursive?: boolean }): Promise<void>;
  watch(
    path: string,
    options?: {
      recursive?: boolean;
      signal?: AbortSignal;
    },
  ): AsyncIterable<{
    eventType: string;
    filename: string;
  }>;
}

export type Storage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export type TitleBarButton = {
  position?: "left" | "right";
  content?: string | Element;
  handler?: (
    ev: PointerEvent & {
      target: HTMLButtonElement;
    },
  ) => void;
  nostyle?: boolean;
};

export type MinicodeKeybind = {
  key: string;
  run: (ctx: MiniCodeContext) => void;
};

export type LanguageConfig = {
  /**
   * List of extensions this config applies to. If multiple
   * configs specify the same extension, the last one wins.
   *
   * @example ext: [".js", ".jsx", ".ts", ".tsx"]
   */
  ext: string[];
  /** Codemirror extension for providing the syntax support. */
  spec?: LanguageSpec;
  /** Function that can be used to format this language code. */
  fromatter?: FormatterFactory;
  formatOnSave?: boolean;
};

export type LspServerConfig = {
  name: string;
  /** Factory that creates the transport to the LSP server. */
  transport: LspTransportFactory;
  /** Extensions this server handles (e.g. [".ts", ".tsx", ".js", ".jsx"]). */
  extensions: string[];
};

export type MiniCodeOptions = {
  root: string;
  filesystem: Filesystem;
  theme?: ThemeInput;
  themes?: Theme[];
  syntaxTheme?: HighlightStyle;
  languages?: LanguageConfig[];
  lsp?: LspServerConfig[];
  terminal?: TerminalFactory;
  storage?: Storage;
  titleBarButtons?: Array<TitleBarButton>;
  keymaps?: {
    global?: Array<MinicodeKeybind>;
    editor?: Array<KeyBinding>;
  };
};

export function MiniCode(opts: MiniCodeOptions) {
  const ctx = new MiniCodeContext(opts);

  const ready = sig(false);

  ctx
    .load()
    .then(() => {
      ready.dispatch(true);
    })
    .catch((err) => {
      ctx.logs.error("Failed to load workspace", err);
      ready.dispatch(true);
    });

  return MinicodeRoot({
    ctx: ctx,
    ready: ready,
    children: () => (
      <>
        <FileTree ctx={ctx} />
        <div class="main-panel">
          <Tabs ctx={ctx} />
          <TerminalPanel ctx={ctx} />
        </div>
      </>
    ),
  });
}

MiniCode.File = function SingleFileEditor(f: string, opts: Omit<MiniCodeOptions, "root">) {
  const filepath = Path.from(f);

  const ctx = new MiniCodeContext({ ...opts, root: filepath.dir().toString() });

  const ready = sig<TabData | Error | null>();

  ctx
    .loadSingleFile(filepath)
    .then((td) => {
      ready.dispatch(td);
    })
    .catch((err) => {
      ctx.logs.error("Failed to load file", err);
      ready.dispatch(err);
    });

  return MinicodeRoot({
    ctx: ctx,
    ready: ready,
    children: (data) => (
      <div class="main-panel">
        <div
          class={{
            codemirror: true,
            focused: true,
          }}
          style={{
            fontSize: ctx.tabs.fontSize,
          }}
        >
          {"view" in data ? data.view?.dom : null}
        </div>
        <TerminalPanel ctx={ctx} />
      </div>
    ),
  });
};
