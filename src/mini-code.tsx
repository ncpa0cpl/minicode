import { sig } from "@ncpa0cpl/vanilla-jsx/signals";
import { FileTree } from "./components/file-tree/file-tree";
import { Tabs } from "./modules/tabs/components/tabs";
import { TerminalPanel } from "./modules/terminal/components/terminal";
import { TopBar } from "./components/topbar/topbar";
import { MiniCodeContext } from "./context";
import { stylesheet } from "./styles";
import { css } from "embedcss";
import type { LanguageSpec } from "./languages";
import type { HighlightStyle } from "@codemirror/language";
import { TerminalFactory } from "./modules/terminal/types";
import { Theme, ThemeInput, themeToCssVars } from "./modules/theme/themes";
import { LspTransportFactory } from "./modules/lsp/types";
import { FormatterFactory } from "./modules/formatter/types";
import { KeyBinding } from "@codemirror/view";

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

const minicodeStyles = css`
  .minicode-root {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;

    scrollbar-width: thin;
    scrollbar-color: var(--minicode-border, #2a2f3a) transparent;

    &:focus,
    &:focus-visible {
      outline: none;
    }
  }

  .minicode-editor {
    display: flex;
    flex-direction: row;
    flex: 1 1 auto;
    min-height: 0;
    width: 100%;
  }

  .main-panel {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-width: 0;
    min-height: 0;
  }

  :host {
    display: block;
    width: 100%;
    height: 100%;
  }

  .loader {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1.54em;
    width: 100%;
    height: 100%;
    background: var(--minicode-bg, #1b1f27);
    color: var(--minicode-fg, #cdd3de);
    font-family: var(--minicode-font, ui-monospace, monospace);
  }

  .loader-spinner {
    width: 2.46em;
    height: 2.46em;
    border: 3px solid var(--minicode-border, #2a2f3a);
    border-top-color: var(--minicode-accent, #4b9fff);
    border-radius: 50%;
    animation: minicode-spin 0.8s linear infinite;
  }

  @keyframes minicode-spin {
    to {
      transform: rotate(360deg);
    }
  }

  .loader-text {
    font-size: 1em;
    color: var(--minicode-muted, #6b7280);
    letter-spacing: 0.04em;
  }

  ::-webkit-scrollbar {
    width: 0.77em;
    height: 0.77em;
  }

  ::-webkit-scrollbar-track {
    background: transparent;
  }

  ::-webkit-scrollbar-thumb {
    background: var(--minicode-border, #2a2f3a);
    border-radius: 0.38em;
    border: 2px solid var(--minicode-bg, #1b1f27);
  }

  ::-webkit-scrollbar-thumb:hover {
    background: var(--minicode-muted, #6b7280);
  }

  ::-webkit-scrollbar-corner {
    background: transparent;
  }
`;

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

  const shadowRootHost = (<div class="minicode-shadow-root"></div>) as HTMLDivElement & {
    minicode: MiniCodeContext;
  };
  const shadowRoot = shadowRootHost.attachShadow({ mode: "closed" });
  ctx.shadowRoot = shadowRoot;
  const onkeydown = (e: KeyboardEvent) => {
    ctx.keymap.handleEvent(e);
  };

  const onclick = (e: PointerEvent) => {
    const target = e.target as Element;
    if (
      target.tagName === "BUTTON" ||
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT" ||
      target.tagName === "AREA" ||
      target.tagName === "A" ||
      ("tabIndex" in target && target.tabIndex === 1)
    ) {
      return;
    }

    const targetClass = cname(target);

    const isInsideEditor =
      targetClass.startsWith("cm-") ||
      targetClass.includes(" cm-") ||
      target.closest(".tab-editor") != null;
    if (isInsideEditor) {
      return;
    }

    const isInsideTerminal =
      targetClass.startsWith("xterm-") ||
      targetClass.includes(" xterm-") ||
      target.closest(".terminal-body") != null;
    if (isInsideTerminal) {
      return;
    }

    minicodeElem.focus();
  };

  const minicodeElem = (
    <div
      class={minicodeStyles}
      style={sig.derive(ctx.themes.theme, ctx.uiFontSize, (theme, fs) => {
        return {
          ...themeToCssVars(theme),
          fontSize: fs,
        };
      })}
      onkeydown={onkeydown}
      onclick={onclick}
      tabIndex={0}
    >
      <style>{stylesheet}</style>
      {ready.derive((ready) =>
        ready ? (
          <>
            <TopBar ctx={ctx} />
            <div class="minicode-editor">
              <FileTree ctx={ctx} />
              <div class="main-panel">
                <Tabs ctx={ctx} />
                <TerminalPanel ctx={ctx} />
              </div>
            </div>
          </>
        ) : (
          <div class="loader">
            <div class="loader-spinner"></div>
            <div class="loader-text">Loading...</div>
          </div>
        ),
      )}
    </div>
  ) as HTMLDivElement;

  shadowRoot.append(minicodeElem);

  shadowRootHost.minicode = ctx;

  return shadowRootHost;
}

function isSvgElem(target: Element) {
  return target.namespaceURI === "http://www.w3.org/2000/svg";
}

function cname(target: Element) {
  if (isSvgElem(target)) {
    let next = target.parentElement;
    while (next && isSvgElem(next)) {
      next = next.parentElement;
    }
    if (next) return "className" in next ? next.className : "";
    return "";
  }
  return "className" in target ? target.className : "";
}
