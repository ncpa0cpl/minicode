import { sig, type Signal } from "@ncpa0cpl/vanilla-jsx/signals";
import { MiniCodeContext } from "../../context";
import { MiniCodeOptions } from "../../mini-code";

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogEntry = {
  id: number;
  level: LogLevel;
  message: string;
  time: number;
  details?: unknown;
};

export const LOG_LEVELS: LogLevel[] = ["debug", "info", "warn", "error"];

export class LogContext {
  logs: Signal<LogEntry[]> = sig<LogEntry[]>([]);
  private nextId = 0;

  constructor(_minicode: MiniCodeContext, _opts: MiniCodeOptions) {}

  add(level: LogLevel, message: string, details?: unknown) {
    const entry: LogEntry = {
      id: this.nextId++,
      level,
      message,
      time: Date.now(),
      details,
    };
    this.logs.dispatch((prev) => [...prev, entry]);
  }

  debug(message: string, details?: unknown) {
    this.add("debug", message, details);
  }

  info(message: string, details?: unknown) {
    this.add("info", message, details);
  }

  warn(message: string, details?: unknown) {
    this.add("warn", message, details);
  }

  error(message: string, details?: unknown) {
    this.add("error", message, details);
  }

  clear() {
    this.logs.dispatch([]);
  }

  count(level: LogLevel): number {
    return this.logs.get().filter((l) => l.level === level).length;
  }
}

export function formatError(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}
