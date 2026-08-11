import { css } from "embedcss";
import { MiniCodeContext, TabData } from "../../context";
import { basicSetup, EditorView } from "codemirror";
import { Range } from "@ncpa0cpl/vanilla-jsx";
const List = Range;

const TabsStyles = css`
  .tabs {
    display: flex;
    flex-direction: column;

    & .tab-bar {
      display: flex;
      flex-direction: row;

      & .tab-btn {
        display: flex;
        flex-direction: row;
        justify-content: space-between;
        align-items: stretch;
      }
    }

    & .tab-editor {
      width: stretch;
      height: stretch;

      & .codemirror {
        &.focused {
          display: contents;
        }
        &:not(.focused) {
          display: none;
        }
      }
    }
  }
`;

export function Tabs({ ctx }: { ctx: MiniCodeContext }) {
  return (
    <div class={TabsStyles}>
      <div class="tab-bar">
        {ctx.opendTabs.$map((t) => {
          return (
            <div class="tab-btn">
              <button onclick={() => ctx.focusTab(t.file)}>{t.file.name}</button>
              <button onclick={() => ctx.closeTab(t.file)}>x</button>
            </div>
          );
        })}
      </div>
      <List data={ctx.opendTabs} into={<div class="tab-editor" />}>
        {(t: TabData) => {
          t.view ??= new EditorView({
            doc: t.initialContent,
            extensions: [basicSetup],
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
