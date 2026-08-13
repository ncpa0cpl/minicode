import type { Extension } from "@codemirror/state";

export type LanguageSpec = Extension | (() => Extension) | (() => Promise<Extension>);

export type LanguagesConfig = Record<string, LanguageSpec>;
