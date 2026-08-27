import { css } from "embedcss";
import { MiniCodeContext } from "../../../context";
import { bindSignal, Range } from "@ncpa0cpl/vanilla-jsx";
import { TabData } from "../types";
import { useTabsContextMenu } from "./context-menu";
import { ContextMenu } from "../../../components/context-menu/context-menu";
import { IconDiagnosticError, IconDiagnosticWarn } from "../../../components/icons/diagnostic-err";
const List = Range;

function closeIcon() {
  return (
    <svg
      attribute:width="0.77em"
      attribute:height="0.77em"
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

const TabsStyles = css`
  .tabs {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    background: var(--minicode-editor-bg, #1b1f27);
  }

  .tab-bar {
    display: flex;
    flex-direction: row;
    flex: 0 0 auto;
    border-bottom: 1px solid var(--minicode-border, #2a2f3a);
    background: var(--minicode-bg, #1b1f27);
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: thin;
  }

  .tab-diagnostics {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.65em;
    background: var(--minicode-bg);
    color: var(--minicode-fg);
    outline: none;
    border: none;
    height: 100%;
    border-left: 1px solid var(--minicode-border);
    gap: 0.4em;
    margin-left: 0.2em;

    & span svg {
      margin-left: 0.2em;
    }

    &,
    & span {
      display: flex;
      justify-content: center;
      align-items: center;
    }
  }

  .tab-btn {
    display: flex;
    flex-direction: row;
    align-items: stretch;
    flex: 0 0 auto;
    border-right: 1px solid var(--minicode-border, #2a2f3a);

    & .tab-name {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.46em;
      padding-block: 0.4em;
      padding-inline: 0.5em;
      border: none;
      background: transparent;
      color: var(--minicode-muted, #6b7280);
      font-family: var(--minicode-font, ui-monospace, monospace);
      font-size: 1em;
      line-height: 1.2;
      cursor: pointer;
      outline: none;
      white-space: nowrap;
      max-width: 15.38em;
      overflow: hidden;
      border-bottom: 2px solid transparent;

      & .tab-label {
        overflow: hidden;
        text-overflow: ellipsis;
      }

      & .tab-dot {
        flex: 0 0 0.46em;
        width: 0.46em;
        height: 0.46em;
        border-radius: 50%;
        background: var(--minicode-accent, #4b9fff);
        visibility: hidden;
      }

      & .tab-dot.dirty {
        visibility: visible;
      }
    }

    & .tab-close {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 1.69em;
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

    &:hover .tab-name {
      color: var(--minicode-fg, #cdd3de);
    }

    &.active .tab-name {
      color: var(--minicode-active-fg, #ffffff);
      background: var(--minicode-editor-bg, #1b1f27);
      border-bottom: 2px solid var(--minicode-accent, #4b9fff);
    }

    &.active .tab-close {
      color: var(--minicode-fg, #cdd3de);
    }
  }

  .tab-editor {
    flex: 1 1 0;
    min-height: 0;
    position: relative;
    overflow: hidden;

    & .codemirror {
      position: absolute;
      inset: 0;
      overflow: hidden;
      container: codemirror / inline-size;

      &.focused {
        display: block;
      }
      &:not(.focused) {
        display: none;
      }
    }
  }

  .empty-state {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--minicode-muted, #6b7280);
    font-family: var(--minicode-font, ui-monospace, monospace);
    font-size: 1em;
    pointer-events: none;
  }
`;

export function Tabs({ ctx }: { ctx: MiniCodeContext }) {
  const { contextMenu, openContextMenu } = useTabsContextMenu(ctx);

  const tabEditor = (
    <div class="tab-editor">
      {ctx.tabs.data.derive((tabs) =>
        tabs.length === 0 ? <div class="empty-state">No file open</div> : null,
      )}
    </div>
  );

  const tabBar = (
    <div class="tab-bar">
      {ctx.tabs.data.$map((t) => {
        const active = ctx.tabs.focused.derive((ft) => !!ft && ft.eq(t.file));

        const diagCounts = t.diagnostics.derive(
          (diagnostics) => {
            const errCount = diagnostics.filter((d) => d.severity === "error").length;
            const warnCount = diagnostics.filter((d) => d.severity === "warning").length;
            return {
              errCount,
              warnCount,
            };
          },
          { compare: (a, b) => a.errCount === b.errCount && a.warnCount === b.warnCount },
        );

        return (
          <div
            class={{ "tab-btn": true, active }}
            onmousedown={(e: MouseEvent) => {
              if (e.button === 1) e.preventDefault();
            }}
            onauxclick={(e: MouseEvent) => {
              if (e.button === 1) {
                e.preventDefault();
                ctx.tabs.close(t.file);
              }
            }}
            oncontextmenu={(e) => openContextMenu(e, t)}
            title={t.file.path}
          >
            <button class="tab-name" onclick={() => ctx.tabs.focus(t.file)}>
              <span class={{ "tab-dot": true, dirty: t.dirty }}></span>
              <span class="tab-label">{t.file.name}</span>

              {diagCounts.derive(({ errCount, warnCount }) => {
                if (errCount === 0 && warnCount === 0) return <></>;

                return (
                  <span class="tab-diagnostics">
                    {errCount > 0 ? (
                      <span>
                        {errCount} <IconDiagnosticError />
                      </span>
                    ) : null}
                    {warnCount > 0 ? (
                      <span>
                        {warnCount} <IconDiagnosticWarn />
                      </span>
                    ) : null}
                  </span>
                );
              })}
            </button>
            <button class="tab-close" onclick={() => ctx.tabs.close(t.file)}>
              {closeIcon()}
            </button>
          </div>
        );
      })}
      {contextMenu.derive((menu) =>
        menu ? (
          <ContextMenu
            items={menu.items}
            x={menu.x}
            y={menu.y}
            onClose={() => contextMenu.dispatch(null)}
          />
        ) : null,
      )}
    </div>
  );

  bindSignal(ctx.tabs.focused, tabBar, (bar) => {
    requestAnimationFrame(() => {
      const el = bar.querySelector(".tab-btn.active");
      if (el) {
        el.scrollIntoView({ inline: "nearest", block: "nearest" });
      }
    });
  });

  return (
    <div class={TabsStyles}>
      {tabBar}
      <List data={ctx.tabs.data} into={tabEditor}>
        {(t: TabData) => {
          return (
            <div
              class={{
                codemirror: true,
                focused: ctx.tabs.focused.derive((ft) => ft && ft.eq(t.file)),
              }}
              style={{
                fontSize: ctx.tabs.fontSize,
              }}
            >
              {t.view.dom}
            </div>
          );
        }}
      </List>
    </div>
  );
}
