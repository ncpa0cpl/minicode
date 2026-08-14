import { Compartment, Extension } from "@codemirror/state";
import { KeyBinding, keymap } from "@codemirror/view";
import { basicSetup, EditorView } from "codemirror";
import {
  standardKeymap,
  indentMore,
  indentLess,
  cursorLineStart,
  cursorLineEnd,
  deleteLine,
  cursorDocStart,
  cursorDocEnd,
} from "@codemirror/commands";
import { foldAll, unfoldAll } from "@codemirror/language";

export class CmPlugin {
  constructor(
    private name: string,
    private compartment: Compartment,
    private editor: EditorView,
  ) {}

  /** replaces all extensions with the list given. removes all if none provided */
  replace(...extensions: Extension[]) {
    this.editor.dispatch({
      effects: this.compartment.reconfigure(extensions),
    });
  }
}

export class CmEditor {
  _editor: EditorView;

  private freeCompartments: Compartment[] = [];
  private plugins = new Map<string, CmPlugin>();

  constructor(
    private shadowRoot: ShadowRoot,
    private initialContent: string,
    private onChange: (content: string) => void,
    maxPlugins: number,
  ) {
    this.freeCompartments = Array.from({ length: maxPlugins }, () => {
      return new Compartment();
    });

    this._editor ??= new EditorView({
      doc: this.initialContent,
      root: this.shadowRoot,
      extensions: [
        keymap.of(CmEditor.keymap()),
        basicSetup,
        EditorView.updateListener.of((u) => {
          if (u.docChanged) {
            this.onChange(u.state.doc.toString());
          }
        }),
        ...this.freeCompartments.map((c) => c.of([])),
      ],
    });
  }

  editor() {
    return this._editor;
  }

  addPlugin(name: string): CmPlugin {
    const compartment = this.freeCompartments.pop();
    if (!compartment) {
      throw new Error("max plugins amount exceeded");
    }

    const p = new CmPlugin(name, compartment, this._editor!);
    this.plugins.set(name, p);

    return p;
  }

  getPlugin(name: string): CmPlugin | undefined {
    return this.plugins.get(name);
  }

  getOrAddPlugin(name: string) {
    return this.getPlugin(name) ?? this.addPlugin(name);
  }

  static keymap() {
    const customKeymaps: KeyBinding[] = [
      {
        key: "Tab",
        preventDefault: true,
        run: indentMore,
      },
      {
        key: "Shift-Tab",
        preventDefault: true,
        run: indentLess,
      },
      {
        key: "Alt-ArrowLeft",
        run: cursorLineStart,
      },
      {
        key: "Alt-ArrowRight",
        run: cursorLineEnd,
      },
      {
        key: "Ctrl-Alt-/",
        run: deleteLine,
      },
      {
        key: "Ctrl-]",
        run: foldAll,
      },
      {
        key: "Ctrl-[",
        run: unfoldAll,
      },
      {
        key: "Home",
        run: cursorDocStart,
      },
      {
        key: "End",
        run: cursorDocEnd,
      },
      {
        key: "F2",
        run(target) {
          return true;
        },
      },
    ];
    const customKeymapsKeys = new Set(customKeymaps.map((e) => e.key));
    const defaultKeymaps = standardKeymap.filter((km) => {
      if (km.key && customKeymapsKeys.has(km.key)) {
        return false;
      }
      if (km.linux && customKeymapsKeys.has(km.linux)) {
        return false;
      }
      if (km.mac && customKeymapsKeys.has(km.mac)) {
        return false;
      }
      if (km.win && customKeymapsKeys.has(km.win)) {
        return false;
      }
      return true;
    });

    const result = [...defaultKeymaps, ...customKeymaps];
    console.log(result);
    return result;
  }
}
