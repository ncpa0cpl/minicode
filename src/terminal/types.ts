export interface TerminalBackend {
  write(data: string): void;
  onData(cb: (data: string) => void): () => void;
  resize(cols: number, rows: number): void;
  dispose(): void;
}

export type TerminalFactory = (opts: { cols: number; rows: number }) => TerminalBackend;
