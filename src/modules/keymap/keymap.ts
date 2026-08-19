import { MiniCodeContext } from "../../context";
import { MinicodeKeybind, MiniCodeOptions } from "../../mini-code";

function openTabCmd(idx: number): MinicodeKeybind["run"] {
  return (ctx) => {
    const tab = ctx.tabs.data.get().at(idx);
    if (!tab) return;
    ctx.tabs.focus(tab.file);
  };
}

/**
 * Context that manages the global key shortcuts.
 *
 * This is not related to the Codemirror Editor shortcuts, which are added
 * in the CmEditor.
 */
export class KeymapContext {
  static defaultKeybinds: MinicodeKeybind[] = [
    {
      key: "Ctrl-s",
      run(ctx) {
        const ft = ctx.tabs.focused.get();
        if (ft) {
          ctx.tabs.save(ft);
        }
      },
    },
    {
      key: "Alt-f",
      run(ctx) {
        const ft = ctx.tabs.focused.get();
        if (ft && ctx.formatter.canFormat(ft)) {
          ctx.tabs.formatContent(ft);
        }
      },
    },
    {
      key: "Ctrl-`",
      run(ctx) {
        if (ctx.terminals.hasTerminalSupport()) {
          ctx.terminals.toggle();
        }
      },
    },
    {
      key: "Meta-1",
      run: openTabCmd(0),
    },
    {
      key: "Meta-2",
      run: openTabCmd(1),
    },
    {
      key: "Meta-3",
      run: openTabCmd(2),
    },
    {
      key: "Meta-4",
      run: openTabCmd(3),
    },
    {
      key: "Meta-5",
      run: openTabCmd(4),
    },
    {
      key: "Meta-6",
      run: openTabCmd(5),
    },
    {
      key: "Meta-7",
      run: openTabCmd(6),
    },
    {
      key: "Meta-8",
      run: openTabCmd(7),
    },
    {
      key: "Meta-9",
      run: openTabCmd(8),
    },
  ];

  keymap: Record<string, (ctx: MiniCodeContext) => void> = {};

  constructor(
    protected readonly minicode: MiniCodeContext,
    protected readonly opts: MiniCodeOptions,
  ) {
    for (const { key, run } of KeymapContext.defaultKeybinds) {
      this.keymap[key] = run;
    }

    const km = this.opts.keymaps?.global ?? [];
    for (const { key, run } of km) {
      this.keymap[key] = run;
    }
  }

  buildKeyString(ev: KeyboardEvent) {
    let strSeg: string[] = [];

    if (ev.ctrlKey) {
      strSeg.push("Ctrl");
    }
    if (ev.shiftKey) {
      strSeg.push("Shift");
    }
    if (ev.altKey) {
      strSeg.push("Alt");
    }
    if (ev.metaKey) {
      strSeg.push("Meta");
    }

    if (ev.key === "Dead" || ev.key === "Unidentified") {
      switch (ev.code) {
        case "Backquote":
          strSeg.push("`");
          break;
      }
    } else {
      if (ev.key !== "Control" && ev.key !== "Alt" && ev.key !== "Shift" && ev.key !== "Meta") {
        strSeg.push(ev.key);
      }
    }

    return strSeg.join("-");
  }

  handleEvent(ev: KeyboardEvent) {
    const keystr = this.buildKeyString(ev);
    const handler = this.keymap[keystr];
    if (handler) {
      ev.preventDefault();
      try {
        handler(this.minicode);
      } catch (err) {
        this.minicode.logs.error(`Keymap handler for '${keystr}' returned an error`, err);
      }
    }
  }
}
