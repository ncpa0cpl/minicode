import { sig, type Signal } from "@ncpa0cpl/vanilla-jsx/signals";
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

/** Maximum subdirectory count for automatic one-level preloading. */
const PRELOAD_THRESHOLD = 32;

export class File {
  private _path;
  private _isDirectory: boolean;
  private _children?: Signal<Array<Signal<File>>>;
  private _expanded?: Signal<boolean>;
  private _loaded?: Signal<boolean>;
  private _loading?: Signal<boolean>;
  private _loadFn?: () => Promise<File>;
  private _loadPromise: Promise<void> | null = null;

  constructor(
    path: string | Path,
    isDirectory: boolean,
    files?: Array<File>,
    loadFn?: () => Promise<File>,
  ) {
    this._path = Path.from(path);
    this._isDirectory = isDirectory;

    if (isDirectory) {
      this._children = sig((files ?? []).sort(sortFiles).map((f) => sig(f)));
      this._expanded = sig(false);
      this._loaded = sig(files !== undefined);
      this._loading = sig(false);
      this._loadFn = loadFn;

      this.expanded.add((expanded) => {
        if (expanded) {
          this.preloadChildren();
        }
      });
    }
  }

  get isDir() {
    return this._isDirectory;
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

  get isLoading() {
    return this._loading;
  }

  get isLoaded() {
    return this._loaded;
  }

  /**
   * Sync signal for rendering. Triggers an automatic load if the directory
   * has not been loaded yet. Always returns the same signal instance — it
   * starts empty and is dispatched into when loading completes, causing a
   * reactive re-render.
   */
  files(): Signal<Array<Signal<File>>> {
    if (!this._loading || !this._loaded || !this._children) {
      throw new Error(`File.files(): ${this.name} is not a directory`);
    }

    if (this._isDirectory && !this._loaded.get() && !this._loading.get() && this._loadFn) {
      this.triggerLoad();
    }
    return this._children;
  }

  /**
   * Semi-async children access for application logic. Returns children
   * synchronously if already loaded, or a Promise that resolves once the
   * load completes. Triggers loading automatically if not yet started.
   */
  children(): Signal<File>[] | Promise<Signal<File>[]> {
    if (!this._loading || !this._loaded || !this._children) {
      throw new Error(`File.children(): ${this.name} is not a directory`);
    }

    if (!this._isDirectory) {
      return [];
    }
    if (this._loaded.get()) {
      return this._children.get();
    }
    if (!this._loadPromise) {
      this.triggerLoad();
    }
    return this._loadPromise!.then(() => this._children!.get());
  }

  loadedChildren() {
    if (!this._children) {
      throw new Error(`File.loadedChildren(): ${this.name} is not a directory`);
    }
    return this._children.get();
  }

  private preloadChildren() {
    if (!this._children) {
      throw new Error(`File.triggerLoad(): ${this.name} is not a directory`);
    }

    // Preload shallow subdirectories if under the threshold.
    const subdirs = this._children.get().filter((f) => f.get().isDir);
    if (subdirs.length <= PRELOAD_THRESHOLD) {
      for (const dir of subdirs) {
        dir.get().triggerLoad();
      }
    }
  }

  private triggerLoad(): void {
    if (!this._loading || !this._loaded || !this._children) {
      throw new Error(`File.triggerLoad(): ${this.name} is not a directory`);
    }

    if (this._loadPromise || this._loaded.get() || !this._loadFn) return;
    this._loading.dispatch(true);
    this._loadPromise = (async () => {
      try {
        const loadedDir = await this._loadFn!();
        const childFiles = loadedDir
          .files()
          .get()
          .map((s) => s.get());
        const sorted = childFiles.sort(sortFiles);
        const wrapped = sorted.map((f) => sig(f));

        this._children!.dispatch(wrapped);
        this._loaded!.dispatch(true);
      } finally {
        this._loading!.dispatch(false);
      }
    })();
  }

  replaceFiles(files: Signal<File>[]) {
    if (!this._isDirectory || !this._children) {
      throw new Error(`File.replaceFiles(): ${this.name} is not a directory`);
    }
    this._children.dispatch(files.sort((a, b) => sortFiles(a.get(), b.get())));
  }

  collapseAll(recursive: boolean) {
    if (!this._isDirectory || !this._loaded || !this._expanded || !this._children) return;
    if (recursive && this._loaded.get()) {
      for (const childSig of this._children.get()) {
        childSig.get().collapseAll(true);
      }
    }
    this._expanded.dispatch(false);
  }

  collapseChildren() {
    if (!this._isDirectory || !this._expanded || !this._children) return;
    if (this._loaded?.get()) {
      for (const childSig of this._children.get()) {
        childSig.get().collapseAll(true);
      }
    }
  }

  eq(f: File | Path | string) {
    if (typeof f === "string" || f instanceof Path) {
      return this._path.equals(f);
    }
    return this._path.equals(f._path);
  }

  rename(newPath: string): File {
    const renamed = new File(newPath, this._isDirectory);
    renamed._children = this._children;
    renamed._expanded = this._expanded;
    renamed._loaded = this._loaded;
    renamed._loading = this._loading;
    renamed._loadFn = this._loadFn;
    renamed._loadPromise = this._loadPromise;
    return renamed;
  }
}
