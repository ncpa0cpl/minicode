import { css } from "embedcss";
import { MiniCodeContext, TabData } from "../../context";
import { basicSetup, EditorView } from "codemirror";
import { Range } from "@ncpa0cpl/vanilla-jsx";
import { defineCodeMirrorTheme } from "../../themes";
const List = Range;

const SVG_NS = "http://www.w3.org/2000/svg";

function closeIcon(): SVGSVGElement {
  const el = document.createElementNS(SVG_NS, "svg");
  el.setAttribute("width", "10");
  el.setAttribute("height", "10");
  el.setAttribute("viewBox", "0 0 16 16");
  const p = document.createElementNS(SVG_NS, "path");
  p.setAttribute("d", "M4 4l8 8M12 4l-8 8");
  p.setAttribute("stroke", "currentColor");
  p.setAttribute("stroke-width", "1.5");
  p.setAttribute("stroke-linecap", "round");
  el.appendChild(p);
  return el;
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

  .tab-btn {
    display: flex;
    flex-direction: row;
    align-items: stretch;
    flex: 0 0 auto;
    border-right: 1px solid var(--minicode-border, #2a2f3a);

    & .tab-name {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 7px 10px 7px 12px;
      border: none;
      background: transparent;
      color: var(--minicode-muted, #6b7280);
      font-family: var(--minicode-font, ui-monospace, monospace);
      font-size: 13px;
      line-height: 1.2;
      cursor: pointer;
      outline: none;
      white-space: nowrap;
      max-width: 200px;
      overflow: hidden;

      & .tab-label {
        overflow: hidden;
        text-overflow: ellipsis;
      }

      & .tab-dot {
        flex: 0 0 6px;
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--minicode-muted, #6b7280);
      }
    }

    & .tab-close {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 22px;
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
      padding-bottom: 5px;
    }

    &.active .tab-dot {
      background: var(--minicode-accent, #4b9fff);
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
    font-size: 13px;
    pointer-events: none;
  }
`;

export function Tabs({ ctx }: { ctx: MiniCodeContext }) {
  const tabEditor = (
    <div class="tab-editor">
      {ctx.opendTabs.derive((tabs) =>
        tabs.length === 0 ? <div class="empty-state">No file open</div> : null,
      )}
    </div>
  );

  return (
    <div class={TabsStyles}>
      <div class="tab-bar">
        {ctx.opendTabs.$map((t) => {
          const active = ctx.focusedTab.derive((ft) => !!ft && ft.eq(t.file));
          return (
            <div class={{ "tab-btn": true, active }}>
              <button class="tab-name" onclick={() => ctx.focusTab(t.file)}>
                <span class="tab-dot"></span>
                <span class="tab-label">{t.file.name}</span>
              </button>
              <button class="tab-close" onclick={() => ctx.closeTab(t.file)}>
                {closeIcon()}
              </button>
            </div>
          );
        })}
      </div>
      <List data={ctx.opendTabs} into={tabEditor}>
        {(t: TabData) => {
          t.view ??= new EditorView({
            doc: t.initialContent,
            root: ctx.shadowRoot,
            extensions: [
              basicSetup,
              ...ctx.getLanguageExtensions(t.file),
              ...ctx.getLspExtensions(t.file),
              ctx.syntaxCompartment.of(ctx.getSyntaxExtension()),
              ctx.themeCompartment.of(defineCodeMirrorTheme(ctx.theme.get())),
            ],
          });

          return (
            <div
              class={{
                codemirror: true,
                focused: ctx.focusedTab.derive((ft) => ft && ft.eq(t.file)),
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
