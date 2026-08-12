import { sig, Signal } from "@ncpa0cpl/vanilla-jsx/signals";
import { MiniCodeContext } from "../../context";
import { MiniCodeOptions } from "../../mini-code";
import {
  darkTheme,
  defineCodeMirrorTheme,
  defineSyntaxHighlighting,
  gnomeDarkTheme,
  gnomeLightTheme,
  lightTheme,
  Theme,
  ThemeInput,
  type HighlightStyle,
} from "./themes";
import { Compartment } from "@codemirror/state";

export class ThemesContext {
  theme: Signal<Theme>;
  available: Theme[] = [];

  private syntaxTheme: HighlightStyle | undefined;
  private themeCompartment = new Compartment();
  private syntaxCompartment = new Compartment();

  constructor(
    private readonly minicode: MiniCodeContext,
    private opts: MiniCodeOptions,
  ) {
    this.syntaxTheme = opts.syntaxTheme;
    this.available = [darkTheme, lightTheme, gnomeDarkTheme, gnomeLightTheme].concat(
      opts.themes ?? [],
    );
    this.theme = sig<Theme>(
      this.resolveTheme(opts.theme ?? minicode.storage.getItem(MiniCodeContext.storageKeys.theme)),
    );

    if (!this.available.some((t) => t.name === this.theme.get().name)) {
      this.available.unshift(this.theme.get());
    }
  }

  private resolveTheme(name?: string | Theme | null) {
    if (typeof name === "string") return this.available.find((t) => t.name === name) ?? darkTheme;
    return name ?? darkTheme;
  }

  set(theme: ThemeInput) {
    theme = this.resolveTheme(theme);
    this.theme.dispatch(theme);
    this.minicode.storage.setItem(MiniCodeContext.storageKeys.theme, theme.name);
    this.minicode.tabs.updateTheme();
    this.minicode.terminals.updateTheme();
  }

  setSyntax(theme: HighlightStyle | undefined) {
    this.syntaxTheme = theme;
    this.minicode.tabs.updateTheme();
  }

  private getSyntaxExtension() {
    const theme = this.theme.get();
    const style = this.syntaxTheme ?? theme.syntax;
    return defineSyntaxHighlighting({ ...theme, syntax: style });
  }

  cmExtensions() {
    return [
      this.syntaxCompartment.of(this.getSyntaxExtension()),
      this.themeCompartment.of(defineCodeMirrorTheme(this.theme.get())),
    ];
  }

  cmExtensionsReconfigure() {
    return [
      this.syntaxCompartment.reconfigure(this.getSyntaxExtension()),
      this.themeCompartment.reconfigure(defineCodeMirrorTheme(this.theme.get())),
    ];
  }
}
