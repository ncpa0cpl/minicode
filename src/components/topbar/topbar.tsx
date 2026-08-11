import { css } from "embedcss";
import { sig } from "@ncpa0cpl/vanilla-jsx/signals";
import { MiniCodeContext } from "../../context";

const TopBarStyles = css`
  .top-bar {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: flex-end;
    gap: 4px;
    flex: 0 0 auto;
    height: 34px;
    padding: 0 8px;
    border-bottom: 1px solid var(--minicode-border, #2a2f3a);
    background: var(--minicode-bg, #1b1f27);
    user-select: none;
  }

  .icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    background: transparent;
    color: var(--minicode-muted, #6b7280);
    cursor: pointer;
    outline: none;
    border-radius: 4px;

    &:hover {
      color: var(--minicode-fg, #cdd3de);
      background: var(--minicode-hover, #232834);
    }

    &.disabled {
      opacity: 0.4;
      cursor: default;
      pointer-events: none;
    }
  }

  .theme-dropdown {
    position: relative;

    & .theme-menu {
      position: absolute;
      top: 100%;
      right: 0;
      margin-top: 4px;
      min-width: 140px;
      background: var(--minicode-bg, #1b1f27);
      border: 1px solid var(--minicode-border, #2a2f3a);
      border-radius: 4px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
      z-index: 100;
      padding: 4px 0;
      font-family: var(--minicode-font, ui-monospace, monospace);
      font-size: 13px;

      & .theme-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 6px 12px;
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
          width: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
      }
    }
  }
`;

function themeIcon() {
  return (
    <svg
      attribute:width="16"
      attribute:height="16"
      attribute:viewBox="0 0 16 16"
      attribute:fill="none"
    >
      <circle
        attribute:cx="8"
        attribute:cy="8"
        attribute:r="6"
        attribute:stroke="currentColor"
        attribute:stroke-width="1.5"
      />
      <path attribute:d="M8 2a6 6 0 0 0 0 12z" attribute:fill="currentColor" />
    </svg>
  );
}

function terminalIcon() {
  return (
    <svg
      attribute:width="16"
      attribute:height="16"
      attribute:viewBox="0 0 16 16"
      attribute:fill="none"
    >
      <path
        attribute:d="M3 5l3 3-3 3"
        attribute:stroke="currentColor"
        attribute:stroke-width="1.5"
        attribute:stroke-linecap="round"
        attribute:stroke-linejoin="round"
      />
      <line
        attribute:x1="8"
        attribute:y1="11"
        attribute:x2="13"
        attribute:y2="11"
        attribute:stroke="currentColor"
        attribute:stroke-width="1.5"
        attribute:stroke-linecap="round"
      />
    </svg>
  );
}

function checkIcon() {
  return (
    <svg
      attribute:width="12"
      attribute:height="12"
      attribute:viewBox="0 0 16 16"
      attribute:fill="none"
    >
      <path
        attribute:d="M3 8l3 3 6-6"
        attribute:stroke="currentColor"
        attribute:stroke-width="2"
        attribute:stroke-linecap="round"
        attribute:stroke-linejoin="round"
      />
    </svg>
  );
}

export function TopBar({ ctx }: { ctx: MiniCodeContext }) {
  const themeMenuOpen = sig(false);

  const closeMenu = (e: Event) => {
    const target = e.target as Node;
    const dropdown = (e.currentTarget as HTMLElement).querySelector(".theme-dropdown");
    if (dropdown && !dropdown.contains(target)) {
      themeMenuOpen.dispatch(false);
    }
  };

  const currentThemeName = ctx.theme.derive((t) => t.name);

  return (
    <div class={TopBarStyles}>
      <div class="top-bar" onclick={closeMenu}>
        <div class="theme-dropdown">
          <button class="icon-btn" onclick={() => themeMenuOpen.dispatch((v) => !v)}>
            {themeIcon()}
          </button>
          {themeMenuOpen.derive((open) =>
            open ? (
              <div class="theme-menu">
                {ctx.availableThemes.map((t) => (
                  <button
                    class={{
                      "theme-item": true,
                      active: currentThemeName.derive((n) => n === t.name),
                    }}
                    onclick={() => {
                      ctx.setTheme(t.name);
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
            disabled: ctx.hasTerminalSupport() ? undefined : true,
          }}
          onclick={() => ctx.toggleTerminal()}
        >
          {terminalIcon()}
        </button>
      </div>
    </div>
  );
}
