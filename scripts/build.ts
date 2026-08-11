import { build } from "@ncpa0cpl/nodepack";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { EmbedCssPlugin } from "embedcss/plugins/esbuild";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const p = (...fpath: string[]) => path.resolve(__dirname, "..", ...fpath);

async function main() {
  const stylesheetJS = new StylesheetFile(p("dist/legacy/styles.js"), "cjs");
  const stylesheetCJS = new StylesheetFile(p("dist/cjs/styles.cjs"), "cjs");
  const stylesheetMJS = new StylesheetFile(p("dist/esm/styles.mjs"), "mjs");

  await build({
    formats: ["cjs", "esm", "legacy"],
    outDir: p("dist"),
    srcDir: p("src"),
    target: "esnext",
    declarations: true,
    tsConfig: p("tsconfig.json"),
    esbuildOptions: {
      jsxImportSource: "@ncpa0cpl/vanilla-jsx",
      external: ["codemirror", "@codemirror/*", "style-mod"],
      plugins: [
        EmbedCssPlugin({
          write: false,
          uniqueClasses: false,
          onStylesheet: (sheet) => {
            stylesheetJS.append(sheet);
            stylesheetCJS.append(sheet);
            stylesheetMJS.append(sheet);
          },
        }),
      ],
    },
  });

  await Promise.all([stylesheetJS.flush(), stylesheetCJS.flush(), stylesheetMJS.flush()]);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

class StylesheetFile {
  styles: Array<string> = [];

  constructor(
    public readonly filepath: string,
    private type: "cjs" | "mjs",
  ) {}

  append(style: string) {
    style = style + "\n";
    if (this.styles.some((s) => s === style)) {
      return;
    }
    this.styles.push(style);
  }

  flush() {
    return fs.promises.writeFile(this.filepath, this.content(), { encoding: "utf-8" });
  }

  private content() {
    const sheet = JSON.stringify(this.styles.join("\n"));

    switch (this.type) {
      case "mjs": {
        return `export const stylesheet = ${sheet};`;
      }
      case "cjs": {
        return `"use strict";
var __export = (target, all) => {
  for (var name in all)
    Object.defineProperty(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of Object.getOwnPropertyNames(from))
      if (!Object.prototype.hasOwnProperty.call(to, key) && key !== except)
        Object.defineProperty(to, key, { get: () => from[key], enumerable: !(desc = Object.getOwnPropertyDescriptor(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(Object.defineProperty({}, "__esModule", { value: true }), mod);
var styles_exports = {};
var stylesheet = ${sheet};
__export(styles_exports, {
  stylesheet: () => stylesheet
});
module.exports = __toCommonJS(styles_exports);
`;
      }
    }
  }
}
