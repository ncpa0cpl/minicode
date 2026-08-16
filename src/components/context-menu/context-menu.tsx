import { css } from "embedcss";

export type MenuItem = {
  label?: string;
  action?: () => void;
  disabled?: boolean;
  separator?: boolean;
};

const ContextMenuStyles = css`
  .context-menu-overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
  }

  .context-menu {
    position: fixed;
    z-index: 1001;
    min-width: 13.85em;
    background: var(--minicode-bg, #1b1f27);
    border: 1px solid var(--minicode-border, #2a2f3a);
    border-radius: 0.46em;
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.5);
    padding: 0.31em 0;
    font-family: var(--minicode-font, ui-monospace, monospace);
    font-size: 1em;
    user-select: none;
  }

  .context-menu-item {
    display: flex;
    align-items: center;
    padding: 0.46em 1.08em;
    color: var(--minicode-fg, #cdd3de);
    cursor: pointer;
    outline: none;
    border: none;
    background: transparent;
    width: 100%;
    text-align: start;
    font: inherit;

    &:hover:not(.disabled) {
      background: var(--minicode-hover, #232834);
      color: var(--minicode-active-fg, #ffffff);
    }

    &.disabled {
      color: var(--minicode-muted, #6b7280);
      cursor: default;
      pointer-events: none;
    }
  }

  .context-menu-separator {
    height: 1px;
    margin: 0.31em 0.62em;
    background: var(--minicode-border, #2a2f3a);
  }
`;

export function ContextMenu({
  items,
  x,
  y,
  onClose,
}: {
  items: MenuItem[];
  x: number;
  y: number;
  onClose: () => void;
}) {
  const menuWidth = 180;
  const menuHeight = items.length * 28 + 8;
  const clampedX = Math.min(x, window.innerWidth - menuWidth - 8);
  const clampedY = Math.min(y, window.innerHeight - menuHeight - 8);

  return (
    <div class={ContextMenuStyles}>
      <div
        class="context-menu-overlay"
        onclick={onClose}
        oncontextmenu={(e: Event) => {
          e.preventDefault();
          onClose();
        }}
      ></div>
      <div
        class="context-menu"
        style={{ left: `${clampedX}px`, top: `${clampedY}px` }}
        onclick={(e: Event) => e.stopPropagation()}
        onkeydown={(e: KeyboardEvent) => {
          if (e.key === "Escape") onClose();
        }}
        tabIndex={-1}
      >
        {items.map((item) =>
          item.separator ? (
            <div class="context-menu-separator"></div>
          ) : (
            <button
              class={{
                "context-menu-item": true,
                disabled: item.disabled,
              }}
              onclick={() => {
                if (!item.disabled) {
                  item.action?.();
                  onClose();
                }
              }}
            >
              {item.label}
            </button>
          ),
        )}
      </div>
    </div>
  );
}
