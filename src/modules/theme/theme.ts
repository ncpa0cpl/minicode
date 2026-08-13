import { ReadonlySignal, Signal } from "@ncpa0cpl/vanilla-jsx/signals";
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
import { localSig } from "../../utils/local-signal";

export class ThemesContext {
  themeName: Signal<string>;
  theme: ReadonlySignal<Theme>;
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
    this.addThemeIfNotExist(opts.theme);

    this.themeName = localSig(
      this.minicode.storage,
      MiniCodeContext.storageKeys.theme,
      (typeof opts.theme === "string" ? opts.theme : opts.theme?.name) ?? darkTheme.name,
    );
    this.theme = this.themeName.derive((tn) => this.resolveTheme(tn));

    if (!this.available.some((t) => t.name === this.theme.get().name)) {
      this.available.unshift(this.theme.get());
    }
  }

  private resolveTheme(name?: string | Theme | null) {
    if (typeof name === "string") return this.available.find((t) => t.name === name) ?? darkTheme;
    return name ?? darkTheme;
  }

  private addThemeIfNotExist(theme: ThemeInput | undefined) {
    if (theme && typeof theme !== "string") {
      if (!this.available.some((t) => t.name === theme.name)) {
        this.available.push(theme);
      }
    }
  }

  set(theme: ThemeInput) {
    this.addThemeIfNotExist(theme);
    theme = this.resolveTheme(theme);
    this.themeName.dispatch(theme.name);
    this.minicode.logs.info(`Theme set to "${theme.name}"`);
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

  getSyntaxStyle(): HighlightStyle | undefined {
    const theme = this.theme.get();
    return this.syntaxTheme ?? theme.syntax;
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
