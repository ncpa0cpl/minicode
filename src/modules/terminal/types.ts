import { Terminal } from "@xterm/xterm";

export interface TerminalBackend {
  start(dir: string): void | Promise<void>;
  write(data: string): void;
  onData(cb: (data: string) => void): () => void;
  resize(cols: number, rows: number): void;
  dispose(): void;
}

export type TerminalFactory = (opts: { cols: number; rows: number }) => TerminalBackend;

export type TerminalTabData = {
  id: number;
  xterm: Terminal;
  backend?: TerminalBackend;
  termEl: HTMLElement;
  fit: () => void;
  setTheme: (theme: Record<string, string>) => void;
  cleanup: () => void;
};
