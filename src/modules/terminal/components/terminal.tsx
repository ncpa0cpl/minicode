import { css } from "embedcss";
import { sig } from "@ncpa0cpl/vanilla-jsx/signals";
import { Range } from "@ncpa0cpl/vanilla-jsx";
import { MiniCodeContext } from "../../../context";
import { TerminalTabData } from "../types";
import { xtermCss } from "../xterm-css";
const List = Range;

function closeIcon() {
  return (
    <svg
      attribute:width="10"
      attribute:height="10"
      attribute:viewBox="0 0 16 16"
      attribute:fill="none"
    >
      <path
        attribute:d="M4 4l8 8M12 4l-8 8"
        attribute:stroke="currentColor"
        attribute:stroke-width="1.5"
        attribute:stroke-linecap="round"
      />
    </svg>
  );
}

function plusIcon() {
  return (
    <svg
      attribute:width="12"
      attribute:height="12"
      attribute:viewBox="0 0 16 16"
      attribute:fill="none"
    >
      <path
        attribute:d="M8 3v10M3 8h10"
        attribute:stroke="currentColor"
        attribute:stroke-width="1.5"
        attribute:stroke-linecap="round"
      />
    </svg>
  );
}

const TerminalStyles = css`
  .terminal-panel {
    display: flex;
    flex-direction: column;
    flex: 0 0 auto;
    min-height: 0;
    border-top: 1px solid var(--minicode-border, #2a2f3a);
    background: var(--minicode-editor-bg, #1b1f27);
  }

  .terminal-resizer {
    flex: 0 0 4px;
    cursor: row-resize;
    background: var(--minicode-border, #2a2f3a);
    transition: background 120ms ease;

    &:hover,
    &.dragging {
      background: var(--minicode-accent, #4b9fff);
    }
  }

  .terminal-header {
    display: flex;
    flex-direction: row;
    align-items: center;
    flex: 0 0 auto;
    border-bottom: 1px solid var(--minicode-border, #2a2f3a);
    background: var(--minicode-bg, #1b1f27);
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: thin;
    height: 32px;
  }

  .terminal-tab {
    display: flex;
    flex-direction: row;
    align-items: center;
    flex: 0 0 auto;
    border-right: 1px solid var(--minicode-border, #2a2f3a);

    & .terminal-tab-name {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 10px;
      border: none;
      background: transparent;
      color: var(--minicode-muted, #6b7280);
      font-family: var(--minicode-font, ui-monospace, monospace);
      font-size: 13px;
      line-height: 1.2;
      cursor: pointer;
      outline: none;
      white-space: nowrap;
    }

    & .terminal-tab-close {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      border: none;
      background: transparent;
      color: var(--minicode-muted, #6b7280);
      cursor: pointer;
      outline: none;

      &:hover {
        color: var(--minicode-fg, #cdd3de);
        background: var(--minicode-hover, #232834);
      }
    }

    &:hover .terminal-tab-name {
      color: var(--minicode-fg, #cdd3de);
    }

    &.active .terminal-tab-name {
      color: var(--minicode-active-fg, #ffffff);
      background: var(--minicode-editor-bg, #1b1f27);
      border-bottom: 2px solid var(--minicode-accent, #4b9fff);
    }

    &.active .terminal-tab-close {
      color: var(--minicode-fg, #cdd3de);
    }
  }

  .terminal-new-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px 8px;
    border: none;
    background: transparent;
    color: var(--minicode-muted, #6b7280);
    cursor: pointer;
    outline: none;

    &:hover {
      color: var(--minicode-fg, #cdd3de);
      background: var(--minicode-hover, #232834);
    }
  }

  .terminal-body {
    flex: 1 1 auto;
    min-height: 0;
    position: relative;
    overflow: hidden;

    & .xterm-container {
      position: absolute;
      inset: 0;
      overflow: hidden;
      padding: 4px;

      &.focused {
        display: block;
      }
      &:not(.focused) {
        display: none;
      }
    }
  }
`;

const MIN_HEIGHT = 80;

export function TerminalPanel({ ctx }: { ctx: MiniCodeContext }) {
  const height = ctx.terminals.height;
  const activeTerminalId = ctx.terminals.active;

  const onPointerDown = (e: PointerEvent) => {
    e.preventDefault();
    const handle = e.currentTarget as HTMLElement;
    handle.setPointerCapture(e.pointerId);
    handle.classList.add("dragging");
    const startY = e.clientY;
    const startH = height.get();

    const onMove = (ev: PointerEvent) => {
      height.dispatch(Math.max(MIN_HEIGHT, startH - (ev.clientY - startY)));
    };
    const onUp = (ev: PointerEvent) => {
      handle.releasePointerCapture(ev.pointerId);
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.classList.remove("dragging");
      requestAnimationFrame(() => {
        ctx.terminals.data.get().forEach((t) => t.fit());
      });
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
  };

  const visible = sig.derive(
    ctx.terminals.isVisible,
    ctx.terminals.data,
    (v, terms) => v && terms.length > 0,
  );

  const bodyRef = (
    <div class="terminal-body">
      <style>{xtermCss}</style>
    </div>
  );

  const resizeObserver = new ResizeObserver(() => {
    requestAnimationFrame(() => {
      ctx.terminals.data.get().forEach((t) => t.fit());
    });
  });
  resizeObserver.observe(bodyRef);

  return (
    <div
      class={TerminalStyles}
      style={{
        height: sig.derive(visible, height, (v, h) => (v ? `${h}px` : "0px")),
        display: visible.derive((v) => (v ? "flex" : "none")),
      }}
    >
      <div class="terminal-resizer" onpointerdown={onPointerDown}></div>
      <div class="terminal-header">
        {ctx.terminals.data.$map((t) => {
          const active = activeTerminalId.derive((id) => id === t.id);
          return (
            <div class={{ "terminal-tab": true, active }}>
              <button class="terminal-tab-name" onclick={() => activeTerminalId.dispatch(t.id)}>
                <span class="tab-label">Terminal {t.id + 1}</span>
              </button>
              <button class="terminal-tab-close" onclick={() => ctx.terminals.close(t.id)}>
                {closeIcon()}
              </button>
            </div>
          );
        })}
        <button class="terminal-new-btn" onclick={() => ctx.terminals.open()}>
          {plusIcon()}
        </button>
      </div>
      {bodyRef}
      <List data={ctx.terminals.data} into={bodyRef}>
        {(t: TerminalTabData) => (
          <div
            class={{
              "xterm-container": true,
              focused: activeTerminalId.derive((id) => id === t.id),
            }}
          >
            {t.termEl}
          </div>
        )}
      </List>
    </div>
  );
}
