import { sig, Signal } from "@ncpa0cpl/vanilla-jsx/signals";
import { MiniCodeContext } from "../../context";
import { MiniCodeOptions } from "../../mini-code";
import { TerminalFactory, TerminalTabData } from "./types";
import { localSig } from "../../utils/local-signal";
import { LogContext } from "../log/log";

export class TerminalsContext {
  fontSize = sig(14);
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
    this.isVisible = localSig(storage, MiniCodeContext.storageKeys.terminalVisible, true);
    this.height = localSig(storage, MiniCodeContext.storageKeys.terminalHeight, 250);

    if (this.isVisible.get()) {
      if (this.hasTerminalSupport()) {
        this.open();
      }
    }

    this.fontSize = localSig(this.minicode.storage, MiniCodeContext.storageKeys.termFontSize, 16);

    this.fontSize.add((fs) => {
      this.data.get().forEach((t) => {
        t.xterm.options.fontSize = fs;
      });
    });
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

  async open(dirPath?: string) {
    if (!this.factory) return;
    try {
      const { Terminal } = await import("@xterm/xterm");
      const { FitAddon } = await import("@xterm/addon-fit");
      const term = new Terminal({
        fontSize: this.fontSize.get(),
        fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
        theme: this.getXtermTheme(),
      });
      term.attachCustomKeyEventHandler((ev) => {
        // paste
        if (ev.key === "v" && ev.ctrlKey && ev.shiftKey && !(ev.metaKey || ev.altKey)) {
          ev.preventDefault();
          navigator.clipboard
            .readText()
            .then((text) => {
              if (!text) return;
              term.paste(text);
            })
            .catch(() => {});
          return false;
        }

        // copy
        if (ev.key === "c" && ev.ctrlKey && ev.shiftKey && !(ev.metaKey || ev.altKey)) {
          ev.preventDefault();
          const text = term.getSelection();
          navigator.clipboard.writeText(text).catch(() => {});
          return false;
        }

        return true;
      });
      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);

      const container = document.createElement("terminal-mounter") as TerminalMounter;
      container._termFactory = this.factory;
      container._initDir = dirPath ?? this.minicode.rootPath;
      container._logger = this.minicode.logs;

      container.style.display = "block";
      container.style.width = "100%";
      container.style.height = "100%";

      const id = this.nextTerminalId++;

      const tabData: TerminalTabData = {
        id,
        termEl: container,
        xterm: term,
        fit: () => fitAddon.fit(),
        setTheme: (theme) => {
          term.options.theme = theme;
        },
        cleanup: () => {},
      };
      container._tabData = tabData;

      this.minicode.logs.debug(`Terminal #${id} backend started`);

      this.data.dispatch((prev) => [...prev, tabData]);
      this.isVisible.dispatch(true);
      this.active.dispatch(id);
    } catch (err) {
      this.minicode.logs.error("Failed to open terminal", err);
    }
  }

  close(id: number) {
    const terms = this.data.get();
    const idx = terms.findIndex((t) => t.id === id);
    if (idx < 0) {
      return;
    }

    const tab = terms[idx]!;
    tab.cleanup();
    this.minicode.logs.debug(`Closing terminal #${id}`);

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
    this.isVisible.dispatch((v) => !v);
    if (this.isVisible.get() && this.data.get().length === 0) {
      this.open();
    }
  }
}

class TerminalMounter extends HTMLElement {
  _tabData?: TerminalTabData;
  _termFactory?: TerminalFactory;
  _initDir?: string;
  _logger?: LogContext;

  connectedCallback() {
    const term = this._tabData!.xterm;
    term.open(this);

    requestAnimationFrame(() => {
      this._tabData!.fit();

      requestAnimationFrame(async () => {
        try {
          const cols = term.cols;
          const rows = term.rows;
          const backend = this._termFactory!({ cols, rows });

          this._logger!.debug(`Opening terminal #${this._tabData!.id} (${cols}x${rows})`);

          this._tabData!.backend = backend;

          const onDataDispose = term.onData((data) => backend.write(data));
          const onBackendDataDispose = backend.onData((data) => term.write(data));
          const onResizeDispose = term.onResize(({ cols, rows }) => backend.resize(cols, rows));

          this._tabData!.cleanup = () => {
            onDataDispose.dispose();
            onBackendDataDispose();
            onResizeDispose.dispose();
            backend.dispose();
            term.dispose();
          };

          await backend.start(this._initDir!);
        } catch (err) {
          this._logger!.error("Failed to open terminal", err);
        }
      });
    });
  }
}

window.customElements.define("terminal-mounter", TerminalMounter);
