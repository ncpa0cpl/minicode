import { sig, Signal } from "@ncpa0cpl/vanilla-jsx/signals";
import { MiniCodeContext } from "../../context";
import { MiniCodeOptions } from "../../mini-code";
import { TerminalFactory, TerminalTabData } from "./types";

export class TerminalsContext {
  data = sig<TerminalTabData[]>([]);
  isVisible: Signal<boolean>;
  active = sig<number | null>(null);
  height: Signal<number>;
  private factory: TerminalFactory | undefined;
  private nextTerminalId = 0;

  constructor(
    private readonly minicode: MiniCodeContext,
    opts: MiniCodeOptions,
  ) {
    const storage = minicode.storage;

    this.factory = opts.terminal;
    this.isVisible = sig(storage.getItem(MiniCodeContext.storageKeys.terminalVisible) === "true");
    this.height = sig(Number(storage.getItem(MiniCodeContext.storageKeys.terminalHeight)) || 250);
    this.isVisible.add((v) => {
      storage.setItem(MiniCodeContext.storageKeys.terminalVisible, String(v));
    });
    this.height.add((h) => {
      storage.setItem(MiniCodeContext.storageKeys.terminalHeight, String(h));
    });

    if (this.isVisible.get()) {
      if (this.hasTerminalSupport()) {
        this.open();
      }
    }
  }

  private getXtermTheme() {
    const t = this.minicode.themes.theme.get();
    return {
      background: t.editorBg,
      foreground: t.editorFg,
      cursor: t.cursor,
      selectionBackground: t.selection,
      black: t.fg,
      red: "#e06c75",
      green: "#98c379",
      yellow: "#e5c07b",
      blue: "#61afef",
      magenta: "#c678dd",
      cyan: "#56b6c2",
      white: t.fg,
      brightBlack: t.muted,
      brightRed: "#e06c75",
      brightGreen: "#98c379",
      brightYellow: "#e5c07b",
      brightBlue: "#61afef",
      brightMagenta: "#c678dd",
      brightCyan: "#56b6c2",
      brightWhite: t.fg,
    };
  }

  hasTerminalSupport() {
    return !!this.factory;
  }

  updateTheme() {
    const xtermTheme = this.getXtermTheme();
    for (const term of this.data.get()) {
      term.setTheme(xtermTheme);
    }
  }

  async open() {
    if (!this.factory) return;
    const { Terminal } = await import("@xterm/xterm");
    const { FitAddon } = await import("@xterm/addon-fit");
    const term = new Terminal({
      fontSize: 13,
      fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
      theme: this.getXtermTheme(),
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    const container = document.createElement("div");
    container.style.width = "100%";
    container.style.height = "100%";
    term.open(container);

    const cols = term.cols;
    const rows = term.rows;
    const backend = this.factory({ cols, rows });

    const onDataDispose = term.onData((data) => backend.write(data));
    const onBackendDataDispose = backend.onData((data) => term.write(data));
    const onResizeDispose = term.onResize(({ cols, rows }) => backend.resize(cols, rows));

    const id = this.nextTerminalId++;
    const tabData: TerminalTabData = {
      id,
      backend,
      termEl: container,
      fit: () => fitAddon.fit(),
      setTheme: (theme) => {
        term.options.theme = theme;
      },
      cleanup: () => {
        onDataDispose.dispose();
        onBackendDataDispose();
        onResizeDispose.dispose();
        backend.dispose();
        term.dispose();
      },
    };

    await backend.start();

    this.data.dispatch((prev) => [...prev, tabData]);
    this.isVisible.dispatch(true);
    this.active.dispatch(id);

    requestAnimationFrame(() => fitAddon.fit());
  }

  close(id: number) {
    const terms = this.data.get();
    const idx = terms.findIndex((t) => t.id === id);
    if (idx < 0) {
      return;
    }

    const tab = terms[idx]!;
    tab.cleanup();

    const newData = terms.slice();
    newData.splice(idx, 1);

    this.data.dispatch(newData);

    if (newData.length === 0) {
      this.active.dispatch(null);
      return;
    }

    if (this.active.get() === id) {
      let nextID: number | null = null;
      if (idx > 0) {
        nextID = terms[idx - 1]!.id;
      } else {
        nextID = terms[idx + 1]!.id;
      }
      this.active.dispatch(nextID);
    }
  }

  toggle() {
    if (this.isVisible.get()) {
      this.isVisible.dispatch(false);
    } else if (this.data.get().length > 0) {
      this.isVisible.dispatch(true);
    } else {
      this.open();
    }
  }
}
