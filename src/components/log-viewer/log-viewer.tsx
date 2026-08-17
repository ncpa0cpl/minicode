import { css } from "embedcss";
import { sig, type ReadonlySignal } from "@ncpa0cpl/vanilla-jsx/signals";
import { MiniCodeContext } from "../../context";
import { type LogLevel, type LogEntry, LOG_LEVELS } from "../../modules/log/log";
import { localSig } from "../../utils/local-signal";
import { CloseIcon } from "../icons/close";

const LogViewerStyles = css`
  .log-overlay {
    position: fixed;
    top: 2.62em;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 500;
    background: rgba(0, 0, 0, 0.55);
    display: flex;
    flex-direction: column;
    padding: 0.92em;
    box-sizing: border-box;
    user-select: none;
  }

  .log-panel {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-height: 0;
    background: var(--minicode-bg, #1b1f27);
    border: 1px solid var(--minicode-border, #2a2f3a);
    border-radius: 0.62em;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
    color: var(--minicode-fg, #cdd3de);
    font-family: var(--minicode-font, ui-monospace, monospace);
    font-size: 1em;
    overflow: hidden;
  }

  .log-header {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.62em;
    flex: 0 0 auto;
    padding: 0.77em 0.92em;
    border-bottom: 1px solid var(--minicode-border, #2a2f3a);
    background: var(--minicode-bg, #1b1f27);
  }

  .log-title {
    font-weight: 600;
    color: var(--minicode-fg, #cdd3de);
    margin-right: 0.31em;
  }

  .log-filters {
    display: flex;
    flex-direction: row;
    gap: 0.46em;
    flex: 1 1 auto;
  }

  .log-filter {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.38em;
    padding: 0.31em 0.69em;
    border: 1px solid var(--minicode-border, #2a2f3a);
    border-radius: 0.31em;
    background: transparent;
    color: var(--minicode-muted, #6b7280);
    font: inherit;
    cursor: pointer;
    outline: none;

    &:hover {
      background: var(--minicode-hover, #232834);
    }

    &.active {
      color: var(--minicode-fg, #cdd3de);

      &.lvl-debug {
        border-color: var(--minicode-muted, #6b7280);
      }
      &.lvl-info {
        border-color: var(--minicode-accent, #4b9fff);
      }
      &.lvl-warn {
        border-color: #e5c07b;
      }
      &.lvl-error {
        border-color: #e06c75;
      }
    }

    & .dot {
      width: 0.62em;
      height: 0.62em;
      border-radius: 50%;
      flex: 0 0 auto;
    }
    &.lvl-debug .dot {
      background: var(--minicode-muted, #6b7280);
    }
    &.lvl-info .dot {
      background: var(--minicode-accent, #4b9fff);
    }
    &.lvl-warn .dot {
      background: #e5c07b;
    }
    &.lvl-error .dot {
      background: #e06c75;
    }

    & .count {
      color: var(--minicode-muted, #6b7280);
      font-size: 0.85em;
    }
  }

  .log-spacer {
    flex: 1 1 auto;
  }

  .log-clear,
  .log-close {
    --btn-size: 2em;
    padding: unset;
    height: var(--btn-size);
    min-width: var(--btn-size);
    display: flex;
    justify-content: center;
    align-items: center;
    border: 1px solid var(--minicode-border, #2a2f3a);
    border-radius: 0.31em;
    background: transparent;
    color: var(--minicode-fg, #cdd3de);
    font: inherit;
    cursor: pointer;
    outline: none;

    &:hover {
      background: var(--minicode-hover, #232834);
    }
  }

  .log-clear.log-clear {
    padding-inline: 0.7em;
  }

  .log-list {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--minicode-border, #2a2f3a) transparent;
  }

  .log-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--minicode-muted, #6b7280);
  }

  .log-row {
    display: flex;
    flex-direction: column;
    padding: 0.46em 0.92em;
    border-bottom: 1px solid var(--minicode-border, #2a2f3a);

    &:hover {
      background: var(--minicode-hover, #232834);
    }
  }

  .log-row-head {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.62em;
  }

  .log-time {
    color: var(--minicode-muted, #6b7280);
    font-size: 0.85em;
    flex: 0 0 auto;
  }

  .log-badge {
    flex: 0 0 auto;
    padding: 0.08em 0.46em;
    border-radius: 0.23em;
    font-size: 0.77em;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;

    &.lvl-debug {
      background: rgba(107, 114, 128, 0.25);
      color: var(--minicode-muted, #6b7280);
    }
    &.lvl-info {
      background: rgba(75, 159, 255, 0.2);
      color: var(--minicode-accent, #4b9fff);
    }
    &.lvl-warn {
      background: rgba(229, 192, 123, 0.2);
      color: #e5c07b;
    }
    &.lvl-error {
      background: rgba(224, 108, 117, 0.2);
      color: #e06c75;
    }
  }

  .log-msg {
    flex: 1 1 auto;
    white-space: pre-wrap;
    word-break: break-word;
    color: var(--minicode-fg, #cdd3de);
    user-select: text;
  }

  .log-details-toggle {
    flex: 0 0 auto;
    background: transparent;
    border: none;
    color: var(--minicode-muted, #6b7280);
    cursor: pointer;
    font: inherit;
    font-size: 0.85em;
    padding: 0;

    &:hover {
      color: var(--minicode-fg, #cdd3de);
    }
  }

  .log-details {
    margin-top: 0.31em;
    padding: 0.46em 0.62em;
    background: var(--minicode-editor-bg, #14171d);
    border: 1px solid var(--minicode-border, #2a2f3a);
    border-radius: 0.31em;
    color: var(--minicode-editor-fg, #cdd3de);
    white-space: pre-wrap;
    word-break: break-word;
    font-size: 0.92em;
    user-select: text;
  }
`;

function formatTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${String(
    d.getMilliseconds(),
  ).padStart(3, "0")}`;
}

function formatDetails(d: unknown): string {
  if (d instanceof Error) return `${d.stack ?? `${d.name}: ${d.message}`}`;
  if (typeof d === "string") return d;
  try {
    return JSON.stringify(d, null, 2);
  } catch {
    return String(d);
  }
}

export function LogViewer({ ctx, onClose }: { ctx: MiniCodeContext; onClose: () => void }) {
  const enabled = localSig<Array<LogLevel>>(ctx.storage, "minicode:logs-filter", [
    "error",
    "info",
    "warn",
  ]);
  const expanded = sig<Set<number>>(new Set());

  const toggleLevel = (lvl: LogLevel) => {
    enabled.dispatch((prev) => {
      const next = new Set(prev);
      if (next.has(lvl)) {
        next.delete(lvl);
      } else {
        next.add(lvl);
      }
      return Array.from(next);
    });
  };

  const toggleExpand = (id: number) => {
    expanded.dispatch((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const filtered = sig.derive(ctx.logs.logs, enabled, (logs, en) => {
    if (en.length === 0) return logs;
    return logs.filter((l) => en.includes(l.level));
  });

  return (
    <div class={LogViewerStyles}>
      <div class="log-overlay">
        <div class="log-panel">
          <div class="log-header">
            <span class="log-title">Logs</span>
            <div class="log-filters">
              {LOG_LEVELS.map((lvl) => (
                <button
                  class={{
                    "log-filter": true,
                    ["lvl-" + lvl]: true,
                    active: enabled.derive((en) => en.includes(lvl)),
                  }}
                  onclick={() => toggleLevel(lvl)}
                >
                  <span class="dot"></span>
                  <span>{lvl}</span>
                  <span class="count">{ctx.logs.count(lvl)}</span>
                </button>
              ))}
            </div>
            <div class="log-spacer"></div>
            <button class="log-clear" onclick={() => ctx.logs.clear()}>
              Clear
            </button>
            <button class="log-close" onclick={onClose}>
              <CloseIcon />
            </button>
          </div>
          <div class="log-list">
            {filtered.derive((logs) =>
              logs.length === 0 ? (
                <div class="log-empty">No logs to show</div>
              ) : (
                logs.map((entry) => (
                  <LogRow
                    entry={entry}
                    expanded={expanded.derive((ex) => ex.has(entry.id))}
                    onToggle={() => toggleExpand(entry.id)}
                  />
                ))
              ),
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function LogRow(props: {
  entry: LogEntry;
  expanded: ReadonlySignal<boolean>;
  onToggle: () => void;
}) {
  const { entry, expanded, onToggle } = props;
  const hasDetails = entry.details !== undefined;

  const onClick = () => {
    if (hasDetails) {
      onToggle();
    }
  };

  return (
    <div class="log-row">
      <div class="log-row-head" onclick={onClick}>
        <span class="log-time">{formatTime(entry.time)}</span>
        <span class={"log-badge lvl-" + entry.level}>{entry.level}</span>
        <span class="log-msg">{entry.message}</span>
        {hasDetails ? (
          <button class="log-details-toggle">{expanded.derive((e) => (e ? "[-]" : "[+]"))}</button>
        ) : null}
      </div>
      {hasDetails &&
        expanded.derive((e) =>
          e ? <div class="log-details">{formatDetails(entry.details)}</div> : null,
        )}
    </div>
  );
}
