import { ReadonlySignal } from "@ncpa0cpl/vanilla-jsx/signals";
import { MiniCodeContext } from "../../context";

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

export function ChevronIcon() {
  return (
    <svg
      attribute:width="0.92em"
      attribute:height="0.92em"
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

export function CollapseIcon() {
  return (
    <svg
      attribute:width="1.08em"
      attribute:height="1.08em"
      attribute:viewBox="0 0 16 16"
      attribute:fill="none"
    >
      <path
        attribute:d="M1.5 4.5h4l1.2 1.5h7.8v7.5a1 1 0 0 1-1 1H2.5a1 1 0 0 1-1-1v-8z"
        attribute:stroke="currentColor"
        attribute:stroke-width="1.2"
        attribute:stroke-linejoin="round"
        attribute:fill="none"
      />
      <rect
        attribute:style="fill:currentColor;stroke-width:1.1"
        attribute:width="6"
        attribute:height="1.35"
        attribute:x="5"
        attribute:y="9.5"
        attribute:rx="0.6"
      />
    </svg>
  );
}

export function DirIcon(props: { expanded: ReadonlySignal<boolean> }) {
  return (
    <svg
      attribute:width="1.08em"
      attribute:height="1.08em"
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

export function FileIcon(props: { ctx: MiniCodeContext; ext?: string }) {
  return (
    <svg
      attribute:width="1.08em"
      attribute:height="1.08em"
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
        attribute:fill={props.ctx.themes.theme.derive((t) => extColor(props.ext, t.fileTypeColors))}
      />
    </svg>
  );
}
