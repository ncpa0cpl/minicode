import { css } from "embedcss";
import { sig } from "@ncpa0cpl/vanilla-jsx/signals";
import type { ReadonlySignal } from "@ncpa0cpl/vanilla-jsx/signals";
import { MiniCodeContext } from "../../context";
import { File } from "../../files";

const MIN_WIDTH = 150;
const DEFAULT_WIDTH = 360;

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
  const width = sig(DEFAULT_WIDTH);

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
      <div class="file-tree">
        {ctx.root.files().$map((f) => {
          return (
            <div>
              {f.derive((f) => {
                if (f.isDir) {
                  return <FileTreeDirectory ctx={ctx} dir={f} level={0} />;
                } else {
                  return <FileTreeFile ctx={ctx} file={f} level={0} />;
                }
              })}
            </div>
          );
        })}
      </div>
      <div class="resizer" onpointerdown={onPointerDown}></div>
    </div>
  );
}

function FileTreeDirectory(props: { ctx: MiniCodeContext; dir: File; level?: number }) {
  const { ctx, dir, level = 0 } = props;
  const expanded = dir.expanded;

  const toggle = () => expanded.dispatch((e) => !e);

  return (
    <div>
      <button
        type="button"
        class={{ row: true, dir: true, expanded }}
        style={{ "--level": level }}
        onclick={toggle}
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
                  return <FileTreeDirectory ctx={ctx} dir={f} level={level + 1} />;
                } else {
                  return <FileTreeFile ctx={ctx} file={f} level={level + 1} />;
                }
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FileTreeFile(props: { ctx: MiniCodeContext; file: File; level?: number }) {
  const { ctx, file, level = 0 } = props;
  const active = ctx.focusedTab.derive((ft) => !!ft && ft.eq(file));

  return (
    <button
      type="button"
      class={{ row: true, active }}
      style={{ "--level": level }}
      onclick={() => ctx.openFile(file)}
    >
      <span class="icon">
        <FileIcon ctx={ctx} ext={file.ext} />
      </span>
      <span class="label">{file.name}</span>
    </button>
  );
}

const SVG_NS = "http://www.w3.org/2000/svg";

function svg(size: number, viewBox: string, children: SVGElement[] | SVGElement): SVGSVGElement {
  const el = document.createElementNS(SVG_NS, "svg");
  el.setAttribute("width", String(size));
  el.setAttribute("height", String(size));
  el.setAttribute("viewBox", viewBox);
  el.setAttribute("fill", "none");
  if (Array.isArray(children)) {
    for (const c of children) el.appendChild(c);
  } else {
    el.appendChild(children);
  }
  return el;
}

function path(d: string, attrs: Record<string, string>): SVGPathElement {
  const el = document.createElementNS(SVG_NS, "path");
  el.setAttribute("d", d);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

function circle(cx: number, cy: number, r: number, fill: string): SVGCircleElement {
  const el = document.createElementNS(SVG_NS, "circle");
  el.setAttribute("cx", String(cx));
  el.setAttribute("cy", String(cy));
  el.setAttribute("r", String(r));
  el.setAttribute("fill", fill);
  return el;
}

function ChevronIcon() {
  return svg(
    12,
    "0 0 16 16",
    path("M6 4l4 4-4 4", {
      stroke: "currentColor",
      "stroke-width": "1.5",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
    }),
  );
}

function DirIcon(props: { expanded: ReadonlySignal<boolean> }) {
  const p = path("M1.5 4.5h4l1.2 1.5h7.8v7.5a1 1 0 0 1-1 1H2.5a1 1 0 0 1-1-1v-8z", {
    stroke: "currentColor",
    "stroke-width": "1.2",
    "stroke-linejoin": "round",
  });
  props.expanded.observe((e) => p.setAttribute("fill", e ? "currentColor" : "none"));
  return svg(14, "0 0 16 16", p);
}

function FileIcon(props: { ctx: MiniCodeContext; ext?: string }) {
  const color = extColor(props.ext, props.ctx.theme.get().fileTypeColors);
  return svg(14, "0 0 16 16", [
    path("M3.5 1.5h6L13 5v9.5a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5v-13a.5.5 0 0 1 .5-.5z", {
      stroke: "currentColor",
      "stroke-width": "1.2",
      "stroke-linejoin": "round",
    }),
    path("M9 1.5V5h4", {
      stroke: "currentColor",
      "stroke-width": "1.2",
      "stroke-linejoin": "round",
    }),
    circle(11, 11, 2.5, color),
  ]);
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
