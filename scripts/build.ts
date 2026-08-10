import { build } from "@ncpa0cpl/nodepack";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const p = (...fpath: string[]) => path.resolve(__dirname, "..", ...fpath);

async function main() {
  await build({
    formats: ["cjs", "esm", "legacy"],
    outDir: p("dist"),
    srcDir: p("src"),
    target: "esnext",
    declarations: true,
    tsConfig: p("tsconfig.json"),
    esbuildOptions: {
      jsxImportSource: "@ncpa0cpl/vanilla-jsx",
    },
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
