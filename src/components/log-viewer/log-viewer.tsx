import { css } from "embedcss";
import { sig, type ReadonlySignal } from "@ncpa0cpl/vanilla-jsx/signals";
import { MiniCodeContext } from "../../context";
import { type LogLevel, type LogEntry, LOG_LEVELS } from "../../modules/log/log";

const LogViewerStyles = css`
  .log-overlay {
    position: fixed;
    top: 34px;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 500;
    background: rgba(0, 0, 0, 0.55);
    display: flex;
    flex-direction: column;
    padding: 12px;
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
    border-radius: 8px;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
    color: var(--minicode-fg, #cdd3de);
    font-family: var(--minicode-font, ui-monospace, monospace);
    font-size: 13px;
    overflow: hidden;
  }

  .log-header {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 8px;
    flex: 0 0 auto;
    padding: 10px 12px;
    border-bottom: 1px solid var(--minicode-border, #2a2f3a);
    background: var(--minicode-bg, #1b1f27);
  }

  .log-title {
    font-weight: 600;
    color: var(--minicode-fg, #cdd3de);
    margin-right: 4px;
  }

  .log-filters {
    display: flex;
    flex-direction: row;
    gap: 6px;
    flex: 1 1 auto;
  }

  .log-filter {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 5px;
    padding: 4px 9px;
    border: 1px solid var(--minicode-border, #2a2f3a);
    border-radius: 4px;
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
      width: 8px;
      height: 8px;
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
      font-size: 11px;
    }
  }

  .log-spacer {
    flex: 1 1 auto;
  }

  .log-clear,
  .log-close {
    padding: 4px 10px;
    border: 1px solid var(--minicode-border, #2a2f3a);
    border-radius: 4px;
    background: transparent;
    color: var(--minicode-fg, #cdd3de);
    font: inherit;
    cursor: pointer;
    outline: none;

    &:hover {
      background: var(--minicode-hover, #232834);
    }
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
    padding: 6px 12px;
    border-bottom: 1px solid var(--minicode-border, #2a2f3a);

    &:hover {
      background: var(--minicode-hover, #232834);
    }
  }

  .log-row-head {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 8px;
  }

  .log-time {
    color: var(--minicode-muted, #6b7280);
    font-size: 11px;
    flex: 0 0 auto;
  }

  .log-badge {
    flex: 0 0 auto;
    padding: 1px 6px;
    border-radius: 3px;
    font-size: 10px;
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
  }

  .log-details-toggle {
    flex: 0 0 auto;
    background: transparent;
    border: none;
    color: var(--minicode-muted, #6b7280);
    cursor: pointer;
    font: inherit;
    font-size: 11px;
    padding: 0;

    &:hover {
      color: var(--minicode-fg, #cdd3de);
    }
  }

  .log-details {
    margin-top: 4px;
    padding: 6px 8px;
    background: var(--minicode-editor-bg, #14171d);
    border: 1px solid var(--minicode-border, #2a2f3a);
    border-radius: 4px;
    color: var(--minicode-editor-fg, #cdd3de);
    white-space: pre-wrap;
    word-break: break-word;
    font-size: 12px;
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
  const enabled = sig<Set<LogLevel>>(new Set(LOG_LEVELS));
  const expanded = sig<Set<number>>(new Set());

  const toggleLevel = (lvl: LogLevel) => {
    enabled.dispatch((prev) => {
      const next = new Set(prev);
      if (next.has(lvl)) {
        next.delete(lvl);
      } else {
        next.add(lvl);
      }
      return next;
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
    if (en.size === 0) return logs;
    return logs.filter((l) => en.has(l.level));
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
                    active: enabled.derive((en) => en.has(lvl)),
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
              Close
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
  return (
    <div class="log-row">
      <div class="log-row-head">
        <span class="log-time">{formatTime(entry.time)}</span>
        <span class={"log-badge lvl-" + entry.level}>{entry.level}</span>
        <span class="log-msg">{entry.message}</span>
        {hasDetails ? (
          <button class="log-details-toggle" onclick={onToggle}>
            {expanded.derive((e) => (e ? "[-]" : "[+]"))}
          </button>
        ) : null}
      </div>
      {hasDetails && expanded.derive((e) => e) ? (
        <div class="log-details">{formatDetails(entry.details)}</div>
      ) : null}
    </div>
  );
}
