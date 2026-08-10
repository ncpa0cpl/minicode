import { File } from "./files";
import { Filesystem, MiniCodeOptions } from "./mini-code";
import { Path } from "./utils/path";

export class MiniCodeContext {
  root!: File;
  filesystem: Filesystem;
  abort = new AbortController();

  constructor(private opts: MiniCodeOptions) {
    this.filesystem = opts.filesystem;
  }

  async load() {
    this.root = await this.loadDir(this.opts.root);
    const watchEvents = this.filesystem.watch(this.root.path, {
      recursive: true,
      signal: this.abort.signal,
    });

    (async () => {
      for await (const event of watchEvents) {
        // update tabs and file tree
      }
    })();
  }

  private async loadDir(filepath: string | Path): Promise<File> {
    const dirpath = Path.from(filepath);
    const files = await this.filesystem.readdir(filepath.toString(), { withFileTypes: true });

    const children = await Promise.all(
      files.map((f) => {
        if (f.isDirectory()) {
          return this.loadDir(dirpath.join(f.name));
        }
        return new File(dirpath.join(f.name), false);
      }),
    );

    return new File(dirpath, true, children);
  }
}
