import { sig, Signal } from "@ncpa0cpl/vanilla-jsx/signals";
import { Path } from "./utils/path";

export class File {
  private _path;
  private contents?: string;
  private children?: Signal<Array<Signal<File>>>;

  constructor(
    path: string | Path,
    private isDirectory: boolean,
    files?: Array<File>,
  ) {
    this._path = Path.from(path);
    if (isDirectory) this.children = sig((files ?? []).map((f) => sig(f)));
  }

  get isDir() {
    return this.isDirectory;
  }

  get path() {
    return this._path.toString();
  }

  get name() {
    return this._path.basename();
  }

  files() {
    if (!this.isDirectory) {
      throw new Error(`File.files(): ${this.name} is not a directory`);
    }
    return this.children!;
  }
}
