import { css } from "embedcss";
import { MiniCodeContext } from "../../context";
import { File } from "../../files";
import { ContextMenu } from "../context-menu/context-menu";
import { useFileContextMenu } from "./context-menu";
import { ChevronIcon, DirIcon, FileIcon } from "./icons";
import { PromptModal } from "../prompt-modal/prompt-modal";

const MIN_WIDTH = 150;

const FileTreeStyles = css`
  .file-tree-wrap {
    display: flex;
    flex-direction: row;
    height: 100%;
    flex: 0 0 auto;
    border-right: 1px solid var(--minicode-border, #2a2f3a);
  }

  .file-tree {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-width: 0;
    height: 100%;
    overflow-x: hidden;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--minicode-border, #2a2f3a) transparent;
    padding: 6px 0;
    font-family: var(--minicode-font, ui-monospace, "SF Mono", Menlo, Consolas, monospace);
    font-size: 13px;
    line-height: 1.4;
    color: var(--minicode-fg, #cdd3de);
    background: var(--minicode-bg, #1b1f27);
    user-select: none;
    padding-left: 8px;
    box-sizing: border-box;

    & .row {
      display: flex;
      flex-direction: row;
      align-items: center;
      width: 100%;
      padding-left: calc(var(--level) * 16);
      padding-right: 8px;
      padding-block: 2px;
      border: none;
      background: transparent;
      color: inherit;
      font: inherit;
      text-align: start;
      cursor: pointer;
      outline: none;

      &:hover {
        background: var(--minicode-hover, #232834);
      }

      &.active {
        background: var(--minicode-active, #2c3344);
        color: var(--minicode-active-fg, #ffffff);
      }

      &.dir {
        & .chevron {
          transition: transform 120ms ease;
          flex: 0 0 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--minicode-muted, #6b7280);
        }
        &.expanded .chevron {
          transform: rotate(90deg);
        }
      }

      & .icon {
        flex: 0 0 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--minicode-muted, #6b7280);
      }

      & .label {
        flex: 1 1 auto;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        padding-left: 4px;
      }
    }

    & .dirfiles {
      display: flex;
      flex-direction: column;
      &.collapsed {
        display: none;
      }
    }
  }

  .resizer {
    flex: 0 0 4px;
    align-self: stretch;
    cursor: col-resize;
    background: var(--minicode-border, #2a2f3a);
    transition: background 120ms ease;

    &:hover,
    &.dragging {
      background: var(--minicode-accent, #4b9fff);
    }
  }
`;

export function FileTree({ ctx }: { ctx: MiniCodeContext }) {
  const width = ctx.fileTreeWidth;

  const { contextMenu, promptState, closePrompt, openContextMenu } = useFileContextMenu(ctx);

  const onPointerDown = (e: PointerEvent) => {
    e.preventDefault();
    const handle = e.currentTarget as HTMLElement;
    handle.setPointerCapture(e.pointerId);
    handle.classList.add("dragging");
    const startX = e.clientX;
    const startW = width.get();

    const onMove = (ev: PointerEvent) => {
      width.dispatch(Math.max(MIN_WIDTH, startW + (ev.clientX - startX)));
    };
    const onUp = (ev: PointerEvent) => {
      handle.releasePointerCapture(ev.pointerId);
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.classList.remove("dragging");
    };

    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
  };

  return (
    <div class={FileTreeStyles} style={{ width: width, display: "flex", flexDirection: "row" }}>
      <div class="file-tree" oncontextmenu={(e: MouseEvent) => openContextMenu(e, null, false)}>
        {ctx.root.files().$map((f) => {
          return (
            <div>
              {f.derive((f) => {
                if (f.isDir) {
                  return (
                    <FileTreeDirectory
                      ctx={ctx}
                      dir={f}
                      level={0}
                      onContextMenu={openContextMenu}
                    />
                  );
                } else {
                  return (
                    <FileTreeFile ctx={ctx} file={f} level={0} onContextMenu={openContextMenu} />
                  );
                }
              })}
            </div>
          );
        })}
      </div>
      <div class="resizer" onpointerdown={onPointerDown}></div>
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
      {promptState.derive((p) =>
        p ? (
          <PromptModal
            title={p.title}
            defaultValue={p.defaultValue}
            onConfirm={(v) => closePrompt(v)}
            onCancel={() => closePrompt(null)}
          />
        ) : null,
      )}
    </div>
  );
}

type ContextMenuHandler = (e: MouseEvent, targetPath: string | null, isDir: boolean) => void;

function FileTreeDirectory(props: {
  ctx: MiniCodeContext;
  dir: File;
  level?: number;
  onContextMenu: ContextMenuHandler;
}) {
  const { ctx, dir, level = 0, onContextMenu } = props;
  const expanded = dir.expanded;

  const toggle = () => expanded.dispatch((e) => !e);

  return (
    <div>
      <button
        type="button"
        class={{ row: true, dir: true, expanded }}
        style={{ "--level": level }}
        onclick={toggle}
        oncontextmenu={(e: MouseEvent) => onContextMenu(e, dir.path, true)}
      >
        <span class="chevron">
          <ChevronIcon />
        </span>
        <span class="icon">
          <DirIcon expanded={expanded} />
        </span>
        <span class="label">{dir.name}</span>
      </button>
      <div class={{ dirfiles: true, collapsed: expanded.derive((e) => !e) }}>
        {dir.files().$map((f) => {
          return (
            <div>
              {f.derive((f) => {
                if (f.isDir) {
                  return (
                    <FileTreeDirectory
                      ctx={ctx}
                      dir={f}
                      level={level + 1}
                      onContextMenu={onContextMenu}
                    />
                  );
                } else {
                  return (
                    <FileTreeFile
                      ctx={ctx}
                      file={f}
                      level={level + 1}
                      onContextMenu={onContextMenu}
                    />
                  );
                }
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FileTreeFile(props: {
  ctx: MiniCodeContext;
  file: File;
  level?: number;
  onContextMenu: ContextMenuHandler;
}) {
  const { ctx, file, level = 0, onContextMenu } = props;
  const active = ctx.tabs.focused.derive((ft) => !!ft && ft.eq(file));

  return (
    <button
      type="button"
      class={{ row: true, active }}
      style={{ "--level": level }}
      onclick={() => ctx.tabs.open(file)}
      oncontextmenu={(e: MouseEvent) => onContextMenu(e, file.path, false)}
    >
      <span class="icon">
        <FileIcon ctx={ctx} ext={file.ext} />
      </span>
      <span class="label">{file.name}</span>
    </button>
  );
}
