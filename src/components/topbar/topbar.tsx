import { css } from "embedcss";
import { sig } from "@ncpa0cpl/vanilla-jsx/signals";
import { MiniCodeContext } from "../../context";
import { LogViewer } from "../log-viewer/log-viewer";
import { checkIcon, logIcon, terminalIcon, themeIcon } from "./icons";

const TopBarStyles = css`
  .top-bar {
    display: flex;
    flex-direction: row;
    align-items: stretch;
    justify-content: stretch;
    flex: 0 0 auto;
    height: 2.62em;
    padding: 0 0.62em;
    border-bottom: 1px solid var(--minicode-border, #2a2f3a);
    background: var(--minicode-bg, #1b1f27);
    user-select: none;
    width: stretch;

    & .top-bar-segments {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      gap: 0.31em;
      flex: 0 0 auto;
      user-select: none;
      height: stretch;
      width: stretch;

      & .top-bar-left {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: flex-start;
        gap: 0.31em;
        flex: 0 0 auto;
      }

      & .top-bar-right {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: flex-end;
        gap: 0.31em;
        flex: 0 0 auto;
      }
    }
  }

  .icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2.15em;
    height: 2.15em;
    border: none;
    background: transparent;
    color: var(--minicode-muted, #6b7280);
    cursor: pointer;
    outline: none;
    border-radius: 0.31em;
    position: relative;

    &.custom {
      width: unset;
    }

    &:hover {
      color: var(--minicode-fg, #cdd3de);
      background: var(--minicode-hover, #232834);
    }

    &.disabled {
      opacity: 0.4;
      cursor: default;
      pointer-events: none;
    }

    & .log-badge {
      position: absolute;
      top: 0.15em;
      right: 0.15em;
      min-width: 1.08em;
      height: 1.08em;
      padding: 0 0.23em;
      box-sizing: border-box;
      border-radius: 0.54em;
      background: #e06c75;
      color: #ffffff;
      font-size: 0.69em;
      line-height: 1.08em;
      text-align: center;
      pointer-events: none;
      display: none;
    }

    & .log-badge.has-count {
      display: block;
    }
  }

  .theme-dropdown {
    position: relative;

    & .theme-menu {
      position: absolute;
      top: 100%;
      right: 0;
      margin-top: 0.31em;
      min-width: 10.77em;
      background: var(--minicode-bg, #1b1f27);
      border: 1px solid var(--minicode-border, #2a2f3a);
      border-radius: 0.31em;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
      z-index: 100;
      padding: 0.31em 0;
      font-family: var(--minicode-font, ui-monospace, monospace);
      font-size: 1em;

      & .theme-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.46em 0.92em;
        color: var(--minicode-fg, #cdd3de);
        cursor: pointer;
        outline: none;
        border: none;
        background: transparent;
        width: 100%;
        text-align: start;
        font: inherit;

        &:hover {
          background: var(--minicode-hover, #232834);
        }

        &.active {
          color: var(--minicode-accent, #4b9fff);
        }

        & .check {
          width: 1.08em;
          display: flex;
          align-items: center;
          justify-content: center;
        }
      }
    }
  }
`;

export function TopBar({ ctx }: { ctx: MiniCodeContext }) {
  const themeMenuOpen = sig(false);
  const logViewerOpen = sig(false);

  const errorCount = ctx.logs.logs.derive((logs) => logs.filter((l) => l.level === "error").length);

  const closeMenu = (e: Event) => {
    const target = e.target as Node;
    const dropdown = (e.currentTarget as HTMLElement).querySelector(".theme-dropdown");
    if (dropdown && !dropdown.contains(target)) {
      themeMenuOpen.dispatch(false);
    }
  };

  const currentThemeName = ctx.themes.theme.derive((t) => t.name);

  return (
    <div class={TopBarStyles}>
      <div class="top-bar-segments" onclick={closeMenu}>
        <div class="top-bar-left">
          {ctx.titlebarCustomLeftButtons().map((spec) => (
            <button
              class={{
                custom: true,
                "left-btn": true,
                "icon-btn": !spec.nostyle,
              }}
              onclick={spec.handler}
            >
              {spec.content}
            </button>
          ))}
        </div>
        <div class="top-bar-right">
          <button class="icon-btn" title="Logs" onclick={() => logViewerOpen.dispatch((v) => !v)}>
            {logIcon()}
            <span class={{ "log-badge": true, "has-count": errorCount.derive((c) => c > 0) }}>
              {errorCount.derive((c) => (c > 99 ? "99+" : String(c)))}
            </span>
          </button>
          <div class="theme-dropdown">
            <button class="icon-btn" onclick={() => themeMenuOpen.dispatch((v) => !v)}>
              {themeIcon()}
            </button>
            {themeMenuOpen.derive((open) =>
              open ? (
                <div class="theme-menu">
                  {ctx.themes.available.map((t) => (
                    <button
                      class={{
                        "theme-item": true,
                        active: currentThemeName.derive((n) => n === t.name),
                      }}
                      onclick={() => {
                        ctx.themes.set(t.name);
                        themeMenuOpen.dispatch(false);
                      }}
                    >
                      <span>{t.name}</span>
                      <span class="check">
                        {currentThemeName.derive((n) => (n === t.name ? checkIcon() : null))}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null,
            )}
          </div>
          <button
            class={{
              "icon-btn": true,
              disabled: ctx.terminals.hasTerminalSupport() ? undefined : true,
            }}
            onclick={() => ctx.terminals.toggle()}
          >
            {terminalIcon()}
          </button>
          {ctx.titlebarCustomRightButtons().map((spec) => (
            <button
              class={{
                custom: true,
                "right-btn": true,
                "icon-btn": !spec.nostyle,
              }}
              onclick={spec.handler}
            >
              {spec.content}
            </button>
          ))}
        </div>
      </div>
      {logViewerOpen.derive((open) =>
        open ? <LogViewer ctx={ctx} onClose={() => logViewerOpen.dispatch(false)} /> : null,
      )}
    </div>
  );
}
