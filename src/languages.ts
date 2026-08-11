import type { Extension } from "@codemirror/state";

export type LanguageSpec = Extension | (() => Extension);

export type LanguagesConfig = Record<string, LanguageSpec>;

export function resolveLanguageExtension(
  languages: LanguagesConfig | undefined,
  ext: string | undefined,
): Extension[] {
  if (!languages || !ext) return [];
  const key = "." + ext;
  const spec = languages[key];
  if (!spec) return [];
  const result = typeof spec === "function" ? spec() : spec;
  return [result];
}
