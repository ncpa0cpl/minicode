import { css } from "embedcss";
import { MiniCodeContext } from "../../context";
import { File } from "../../files";
import { ContextMenu } from "../context-menu/context-menu";
import { useFileContextMenu } from "./context-menu";
import { ChevronIcon, CollapseIcon, DirIcon, FileIcon } from "./icons";
import { PromptModal } from "../prompt-modal/prompt-modal";
import { sig } from "@ncpa0cpl/vanilla-jsx/signals";

const MIN_WIDTH = 150;

const FileTreeStyles = css`
  .file-tree-wrap {
    display: flex;
    flex-direction: row;
    height: 100%;
    flex: 0 0 auto;
    border-right: 1px solid var(--minicode-border, #2a2f3a);
  }

  .file-tree-content {
    display: flex;
    flex-direction: column;
    height: 100%;
    flex: 1 1 auto;
    overflow: hidden;
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
    font-family: var(--minicode-font, ui-monospace, "SF Mono", Menlo, Consolas, monospace);
    font-size: 1em;
    line-height: 1.4;
    color: var(--minicode-fg, #cdd3de);
    background: var(--minicode-bg, #1b1f27);
    user-select: none;
    padding-left: 0.62em;
    box-sizing: border-box;

    & .row {
      display: flex;
      flex-direction: row;
      align-items: center;
      width: 100%;
      padding-left: calc(var(--level) * 1.23em);
      padding-right: 0.62em;
      padding-block: 0.15em;
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
          flex: 0 0 1.23em;
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
        flex: 0 0 1.23em;
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
        padding-left: 0.31em;
      }
    }

    & .dirfiles {
      display: flex;
      flex-direction: column;
      &.collapsed {
        display: none;
      }
    }

    & .row .collapse-btn {
      flex: 0 0 1.38em;
      width: 1.38em;
      height: 1.38em;
      display: flex;
      align-items: center;
      justify-content: center;
      border: none;
      background: transparent;
      color: var(--minicode-muted, #6b7280);
      cursor: pointer;
      outline: none;
      padding: 0;
      opacity: 0;
      transition:
        opacity 100ms ease,
        background 100ms ease;
      border-radius: 0.23em;

      &:hover {
        color: var(--minicode-fg, #cdd3de);
        background: var(--minicode-hover, #232834);
      }
    }

    & .row:hover .collapse-btn {
      opacity: 1;
    }
  }

  .project-header {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    padding: 0.46em 0.62em;
    border-bottom: 1px solid var(--minicode-border, #2a2f3a);
    font-weight: 600;
    color: var(--minicode-fg, #cdd3de);
    user-select: none;
    background-color: var(--minicode-bg, #1b1f27);

    & .project-name {
      flex: 1 1 auto;
      text-align: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    & .collapse-btn {
      flex: 0 0 1.38em;
      width: 1.38em;
      height: 1.38em;
      display: flex;
      align-items: center;
      justify-content: center;
      border: none;
      background: transparent;
      color: var(--minicode-muted, #6b7280);
      cursor: pointer;
      outline: none;
      padding: 0;
      border-radius: 0.23em;
      opacity: 0.6;

      &:hover {
        opacity: 1;
        color: var(--minicode-fg, #cdd3de);
        background: var(--minicode-hover, #232834);
      }
    }
  }

  .resizer {
    flex: 0 0 0.31em;
    align-self: stretch;
    cursor: col-resize;
    background: var(--minicode-border, #2a2f3a);
    transition: background 120ms ease;

    &:hover,
    &.dragging {
      background: var(--minicode-accent, #4b9fff);
    }
  }

  .tree-loading-row {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.46em;
    padding: 0.31em 0.62em 0.31em 0;
    color: var(--minicode-muted, #6b7280);
    font-size: 0.92em;
    user-select: none;
  }

  .tree-loading-spinner {
    flex: 0 0 0.92em;
    width: 0.92em;
    height: 0.92em;
    border: 1.5px solid var(--minicode-border, #2a2f3a);
    border-top-color: var(--minicode-accent, #4b9fff);
    border-radius: 50%;
    animation: tree-spin 0.6s linear infinite;
  }

  @keyframes tree-spin {
    to {
      transform: rotate(360deg);
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
    <div
      class={FileTreeStyles}
      style={{
        width: width,
        display: sig.when(ctx.fileTreeVisible, "flex", "none"),
      }}
    >
      <div class="file-tree-content">
        <div class="project-header">
          <span class="project-name">{ctx.root.name}</span>
          <button
            class="collapse-btn"
            title="Collapse all directories"
            onclick={(e: MouseEvent) => {
              e.stopPropagation();
              ctx.root.collapseAll(true);
            }}
          >
            <CollapseIcon />
          </button>
        </div>
        <div class="file-tree" oncontextmenu={(e: MouseEvent) => openContextMenu(e, null)}>
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

type ContextMenuHandler = (e: MouseEvent, target: File | null) => void;

function FileTreeDirectory(props: {
  ctx: MiniCodeContext;
  dir: File;
  level?: number;
  onContextMenu: ContextMenuHandler;
}) {
  const { ctx, dir, level = 0, onContextMenu } = props;
  const expanded = dir.expanded;

  const toggle = () => expanded.dispatch((e) => !e);

  const expandedOrLoaded = sig.or(expanded, dir.isLoaded);

  return (
    <div>
      <button
        type="button"
        class={{ row: true, dir: true, expanded }}
        style={{ "--level": String(level) }}
        onclick={toggle}
        oncontextmenu={(e: MouseEvent) => onContextMenu(e, dir)}
        title={dir.path}
      >
        <span class="chevron">
          <ChevronIcon />
        </span>
        <span class="icon">
          <DirIcon expanded={expanded} />
        </span>
        <span class="label">{dir.name}</span>
        <span
          class="collapse-btn"
          title="Collapse subdirectories"
          onclick={(e: MouseEvent) => {
            e.stopPropagation();
            dir.collapseChildren();
          }}
        >
          <CollapseIcon />
        </span>
      </button>
      <div class={{ dirfiles: true, collapsed: expanded.derive((e) => !e) }}>
        {dir.isLoading!.derive((l) =>
          l && !dir.isLoaded ? (
            <div class="tree-loading-row" style={{ "--level": String(level + 1) }}>
              <span class="tree-loading-spinner"></span>
              <span>Loading…</span>
            </div>
          ) : null,
        )}
        {expandedOrLoaded.derive((eol) =>
          eol ? (
            <div style={{ display: "contents" }}>
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
          ) : null,
        )}
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
      style={{ "--level": String(level) }}
      onclick={() => ctx.tabs.open(file)}
      oncontextmenu={(e: MouseEvent) => onContextMenu(e, file)}
      title={file.path}
    >
      <span class="icon">
        <FileIcon ctx={ctx} ext={file.ext} />
      </span>
      <span class="label">{file.name}</span>
    </button>
  );
}
