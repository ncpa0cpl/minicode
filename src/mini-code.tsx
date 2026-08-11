import { sig } from "@ncpa0cpl/vanilla-jsx/signals";
import { FileTree } from "./components/file-tree/file-tree";
import { Tabs } from "./components/tabs/tabs";
import { MiniCodeContext } from "./context";
import { stylesheet } from "./styles";
import { css } from "embedcss";
import { themeToCssVars, type ThemeInput } from "./themes";
import type { LanguagesConfig } from "./languages";
import type { LspFactoryConfig } from "./lsp/manager";
import type { HighlightStyle } from "@codemirror/language";

export type Dirent = {
  isDirectory(): boolean;
  isFile(): boolean;
  isSymbolicLink(): boolean;
  name: string;
};

export interface Filesystem {
  readdir(path: string): Promise<string[]>;
  readdir(path: string, opts: { withFileTypes: true }): Promise<Dirent[]>;
  readFile(path: string, encoding: "utf-8"): Promise<string>;
  writeFile(path: string, data: string): Promise<void>;
  unlink(path: string): Promise<void>;
  mkdir(path: string): Promise<void>;
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

export type MiniCodeOptions = {
  root: string;
  filesystem: Filesystem;
  theme?: ThemeInput;
  syntaxTheme?: HighlightStyle;
  languages?: LanguagesConfig;
  lsp?: LspFactoryConfig;
};

const minicodeStyles = css`
  .minicode-editor {
    display: flex;
    flex-direction: row;
    width: 100%;
    height: 100%;

    scrollbar-width: thin;
    scrollbar-color: var(--minicode-border, #2a2f3a) transparent;
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
    gap: 20px;
    width: 100%;
    height: 100%;
    background: var(--minicode-bg, #1b1f27);
    color: var(--minicode-fg, #cdd3de);
    font-family: var(--minicode-font, ui-monospace, monospace);
  }

  .loader-spinner {
    width: 32px;
    height: 32px;
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
    font-size: 13px;
    color: var(--minicode-muted, #6b7280);
    letter-spacing: 0.04em;
  }

  ::-webkit-scrollbar {
    width: 10px;
    height: 10px;
  }

  ::-webkit-scrollbar-track {
    background: transparent;
  }

  ::-webkit-scrollbar-thumb {
    background: var(--minicode-border, #2a2f3a);
    border-radius: 5px;
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

  ctx.load().then(() => {
    ready.dispatch(true);
  });

  const shadowRootHost = <div class="minicode-shadow-root"></div>;
  const shadowRoot = shadowRootHost.attachShadow({ mode: "closed" });
  ctx.shadowRoot = shadowRoot;
  shadowRoot.append(
    <div class={minicodeStyles} style={ctx.theme.derive((t) => themeToCssVars(t))}>
      <style>{stylesheet}</style>
      {ready.derive((ready) =>
        ready ? (
          <>
            <FileTree ctx={ctx} />
            <Tabs ctx={ctx} />
          </>
        ) : (
          <div class="loader">
            <div class="loader-spinner"></div>
            <div class="loader-text">Loading...</div>
          </div>
        ),
      )}
    </div>,
  );

  return shadowRootHost;
}
