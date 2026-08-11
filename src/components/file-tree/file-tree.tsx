import { css } from "embedcss";
import { sig } from "@ncpa0cpl/vanilla-jsx/signals";
import type { ReadonlySignal } from "@ncpa0cpl/vanilla-jsx/signals";
import { MiniCodeContext } from "../../context";
import { File } from "../../files";
import { Path } from "../../utils/path";
import { ContextMenu, type MenuItem } from "../context-menu/context-menu";

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

type ContextMenuState = {
  items: MenuItem[];
  x: number;
  y: number;
};

type Clipboard = { path: string; cut: boolean };

export function FileTree({ ctx }: { ctx: MiniCodeContext }) {
  const width = ctx.fileTreeWidth;
  const contextMenu = sig<ContextMenuState | null>(null);
  const clipboard = sig<Clipboard | null>(null);

  const buildMenuItems = (targetPath: string | null, isDir: boolean): MenuItem[] => {
    const items: MenuItem[] = [];
    const dirPath = targetPath
      ? isDir
        ? targetPath
        : Path.from(targetPath).dir().toString()
      : ctx.root.path;

    items.push({ label: "New File", action: () => newFile(dirPath) });
    items.push({ label: "New Folder", action: () => newFolder(dirPath) });

    if (targetPath) {
      items.push({ separator: true });
      items.push({
        label: "Cut",
        action: () => clipboard.dispatch({ path: targetPath, cut: true }),
      });
      items.push({
        label: "Copy",
        action: () => clipboard.dispatch({ path: targetPath, cut: false }),
      });
    }

    if (clipboard.get()) {
      items.push({ separator: true });
      items.push({
        label: "Paste",
        action: () => {
          const cb = clipboard.get()!;
          if (cb.cut) {
            ctx.movePathTo(cb.path, dirPath);
            clipboard.dispatch(null);
          } else {
            ctx.copyPathTo(cb.path, dirPath);
          }
        },
      });
    }

    if (targetPath) {
      items.push({ separator: true });
      items.push({
        label: "Rename",
        action: () => {
          const newName = prompt("Enter new name:", Path.from(targetPath).basename());
          if (newName && newName !== Path.from(targetPath).basename()) {
            ctx.renamePath(targetPath, newName);
          }
        },
      });
      items.push({
        label: "Delete",
        action: () => {
          if (confirm(`Delete "${Path.from(targetPath).basename()}"?`)) {
            ctx.deletePath(targetPath);
          }
        },
      });
    }

    return items;
  };

  const newFile = (dirPath: string) => {
    const name = prompt("Enter file name:");
    if (name) ctx.createFile(dirPath, name);
  };

  const newFolder = (dirPath: string) => {
    const name = prompt("Enter folder name:");
    if (name) ctx.createDirectory(dirPath, name);
  };

  const openContextMenu = (e: MouseEvent, targetPath: string | null, isDir: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    contextMenu.dispatch({
      items: buildMenuItems(targetPath, isDir),
      x: e.clientX,
      y: e.clientY,
    });
  };

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
  const active = ctx.focusedTab.derive((ft) => !!ft && ft.eq(file));

  return (
    <button
      type="button"
      class={{ row: true, active }}
      style={{ "--level": level }}
      onclick={() => ctx.openFile(file)}
      oncontextmenu={(e: MouseEvent) => onContextMenu(e, file.path, false)}
    >
      <span class="icon">
        <FileIcon ctx={ctx} ext={file.ext} />
      </span>
      <span class="label">{file.name}</span>
    </button>
  );
}

function ChevronIcon() {
  return (
    <svg
      attribute:width={12}
      attribute:height="12"
      attribute:viewBox="0 0 16 16"
      attribute:fill="none"
    >
      <path
        attribute:d="M6 4l4 4-4 4"
        attribute:stroke="currentColor"
        attribute:stroke-width="1.5"
        attribute:stroke-linecap="round"
        attribute:stroke-linejoin="round"
      />
    </svg>
  );
}

function DirIcon(props: { expanded: ReadonlySignal<boolean> }) {
  return (
    <svg
      attribute:width="14"
      attribute:height="14"
      attribute:viewBox="0 0 16 16"
      attribute:fill="none"
    >
      <path
        attribute:d="M1.5 4.5h4l1.2 1.5h7.8v7.5a1 1 0 0 1-1 1H2.5a1 1 0 0 1-1-1v-8z"
        attribute:stroke="currentColor"
        attribute:stroke-width="1.2"
        attribute:stroke-linejoin="round"
        attribute:fill={props.expanded.derive((e) => (e ? "currentColor" : "none"))}
      />
    </svg>
  );
}

function FileIcon(props: { ctx: MiniCodeContext; ext?: string }) {
  return (
    <svg
      attribute:width="14"
      attribute:height="14"
      attribute:viewBox="0 0 16 16"
      attribute:fill="none"
    >
      <path
        attribute:d="M3.5 1.5h6L13 5v9.5a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5v-13a.5.5 0 0 1 .5-.5z"
        attribute:stroke="currentColor"
        attribute:stroke-width="1.2"
        attribute:stroke-linejoin="round"
      />
      <path
        attribute:d="M9 1.5V5h4"
        attribute:stroke="currentColor"
        attribute:stroke-width="1.2"
        attribute:stroke-linejoin="round"
      />
      <circle
        attribute:cx="11"
        attribute:cy="11"
        attribute:r="2.5"
        attribute:fill={props.ctx.theme.derive((t) => extColor(props.ext, t.fileTypeColors))}
      />
    </svg>
  );
}

const DEFAULT_EXT_COLORS: Record<string, string> = {
  ts: "#3178c6",
  tsx: "#3178c6",
  js: "#f0db4f",
  jsx: "#f0db4f",
  mjs: "#f0db4f",
  cjs: "#f0db4f",
  json: "#cbcb41",
  css: "#42a5f5",
  scss: "#42a5f5",
  sass: "#42a5f5",
  html: "#e44d26",
  htm: "#e44d26",
  md: "#519aba",
  py: "#3572a5",
  rs: "#dea584",
  go: "#00add8",
  lock: "#9aa0a6",
};

function extColor(ext: string | undefined, overrides?: Record<string, string>): string {
  if (ext && overrides) {
    const o = overrides[ext];
    if (o) return o;
  }
  if (ext) {
    const d = DEFAULT_EXT_COLORS[ext];
    if (d) return d;
  }
  return "#9aa0a6";
}
