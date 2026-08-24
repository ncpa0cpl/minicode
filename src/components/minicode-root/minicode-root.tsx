import { sig, ReadonlySignal } from "@ncpa0cpl/vanilla-jsx/signals";
import { FileTree } from "../file-tree/file-tree";
import { Tabs } from "../../modules/tabs/components/tabs";
import { TerminalPanel } from "../../modules/terminal/components/terminal";
import { TopBar } from "../topbar/topbar";
import { MiniCodeContext } from "../../context";
import { stylesheet } from "../../styles";
import { css } from "embedcss";
import type { LanguageSpec } from "../../languages";
import type { HighlightStyle } from "@codemirror/language";
import { TerminalFactory } from "../../modules/terminal/types";
import { Theme, ThemeInput, themeToCssVars } from "../../modules/theme/themes";
import { LspTransportFactory } from "../../modules/lsp/types";
import { FormatterFactory } from "../../modules/formatter/types";
import { KeyBinding } from "@codemirror/view";
import { Path } from "../../utils/path";
import { TabData } from "../../modules/tabs/types";
import { FullscreenLoader } from "../fullscreen-loader/fullscreen-loader";

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

export function MinicodeRoot<T>(props: {
  ctx: MiniCodeContext;
  ready: ReadonlySignal<T>;
  children: (value: NonNullable<T>) => JSX.Children;
}) {
  const { ctx, ready, children } = props;

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
      {ready.derive((td) =>
        td ? (
          <>
            <div class="minicode-editor">{children(td)}</div>
          </>
        ) : (
          <FullscreenLoader />
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
