import { sig, Signal } from "@ncpa0cpl/vanilla-jsx/signals";
import { Path } from "./utils/path";

const collator = Intl.Collator(undefined, {
  numeric: true,
  caseFirst: "false",
  sensitivity: "base",
});

function sortFiles(a: File, b: File) {
  const dcmp = Number(b.isDir) - Number(a.isDir);
  if (dcmp === 0) {
    return collator.compare(a.name, b.name);
  }
  return dcmp;
}

export class File {
  private _path;
  private contents?: string;
  private children?: Signal<Array<Signal<File>>>;
  private _expanded?: Signal<boolean>;

  constructor(
    path: string | Path,
    private isDirectory: boolean,
    files?: Array<File>,
  ) {
    this._path = Path.from(path);
    if (isDirectory) {
      this.children = sig((files ?? []).sort(sortFiles).map((f) => sig(f)));
      this._expanded = sig(false);
    }
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

  get ext() {
    return this._path.ext();
  }

  get expanded() {
    if (!this._expanded) {
      throw new Error(`File.expanded(): ${this.name} is not a directory`);
    }
    return this._expanded;
  }

  files() {
    if (!this.isDirectory) {
      throw new Error(`File.files(): ${this.name} is not a directory`);
    }
    return this.children!;
  }

  eq(f: File | Path | string) {
    if (typeof f === "string" || f instanceof Path) {
      return this._path.equals(f);
    }
    return this._path.equals(f._path);
  }
}
