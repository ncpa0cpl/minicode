export class Path {
  static split(path: string) {
    const _segments: string[] = [];
    const _type = path.startsWith("/") ? "absolute" : "relative";
    for (let i = 0; i < path.length; i++) {
      let segment = "";
      while (i < path.length && path[i] !== "/") {
        segment += path[i];
        i++;
      }
      if (segment.length === 0) {
        continue;
      }
      _segments.push(segment);
    }
    return [_segments, _type] as [segments: string[], type: "absolute" | "relative"];
  }

  static from(path: Path | string | string[], type?: "absolute" | "relative"): Path {
    if (path instanceof Path) {
      return path;
    }

    if (Array.isArray(path)) {
      let result = Object.create(Path.prototype) as Path;
      result._segments = [];
      result._type = type ?? "absolute";
      for (const segment of path) {
        if (segment.includes("/")) {
          throw new Error("Invalid segment");
        }
        result._segments.push(segment);
      }
      Object.freeze(result._segments);
      return result;
    }

    return new Path(path);
  }

  static equal(p1: Path | string, p2: Path | string) {
    return Path.from(p1).equals(p2);
  }

  private _segments: string[];
  private _type: "absolute" | "relative";

  constructor(path: string) {
    [this._segments, this._type] = Path.split(path);
    Object.freeze(this._segments);
  }

  private concatSegments(): string {
    let result = this._type === "absolute" ? "/" : "";
    for (const segment of this._segments) {
      result += segment + "/";
    }
    if (this._segments.length > 0) {
      result = result.slice(0, -1);
    }
    return result;
  }

  /**
   * Joins two paths together and returns a new Path object with the result.
   */
  join(path: Path | string): Path {
    if (typeof path === "string") {
      const [pathSegments] = Path.split(path);
      const result = Object.create(Path.prototype) as Path;
      result._segments = this._segments.slice();
      result._segments.push(...pathSegments);
      result._type = this._type;
      Object.freeze(result._segments);
      return result;
    } else {
      const result = Object.create(Path.prototype) as Path;
      result._segments = this._segments.concat(path._segments);
      result._type = path._type;
      Object.freeze(result._segments);
      return result;
    }
  }

  slice(endIdx: number): Path {
    const result = Object.create(Path.prototype) as Path;
    result._segments = this._segments.slice(0, endIdx);
    result._type = this._type;
    Object.freeze(result._segments);
    return result;
  }

  /**
   * Removes the last segment from the path and returns a new Path object with the result.
   */
  dir(): Path {
    const result = Object.create(Path.prototype) as Path;
    result._segments = this._segments.slice(0, -1);
    result._type = this._type;
    Object.freeze(result._segments);
    return result;
  }

  /**
   * Normalizes the path by removing "." and ".." segments.
   */
  normalize(): Path {
    const result = Object.create(Path.prototype) as Path;
    result._segments = [];
    result._type = this._type;
    for (let i = 0; i < this._segments.length; i++) {
      const segment = this._segments[i]!;
      if (segment === "..") {
        if (result._segments.length > 0) {
          result._segments.pop();
        }
      } else if (segment !== ".") {
        result._segments.push(segment);
      }
    }
    Object.freeze(result._segments);
    return result;
  }

  toString(): string {
    return this.normalize().concatSegments();
  }

  segments(): string[] {
    return this._segments.slice();
  }

  isAbsolute(): boolean {
    return this._type === "absolute";
  }

  isRelative(): boolean {
    return this._type === "relative";
  }

  equals(other: Path | string): boolean {
    const otherPath = Path.from(other).normalize();
    const selfNormal = this.normalize();

    if (otherPath._segments.length !== selfNormal._segments.length) {
      return false;
    }

    for (let i = 0; i < selfNormal._segments.length; i++) {
      if (selfNormal._segments[i] !== otherPath._segments[i]) {
        return false;
      }
    }

    return true;
  }

  isInside(parent: Path | string): boolean {
    parent = Path.from(parent);
    if (parent._segments.length >= this._segments.length) return false;
    for (let i = 0; i < parent._segments.length; i++) {
      const thisSegment = this._segments[i];
      const parentSegment = parent._segments[i];
      if (thisSegment !== parentSegment) return false;
    }
    return true;
  }

  /**
   * Returns the extension of the file or undefined if there is none.
   */
  ext(): string | undefined {
    const lastSegment = this._segments[this._segments.length - 1]!;
    const idx = lastSegment.lastIndexOf(".");
    if (idx === -1) {
      return;
    }
    return lastSegment.slice(idx + 1);
  }

  /**
   * Returns the basename of the file. Can be passed a `false` argument to exclude the extension.
   */
  basename(ext = true): string {
    const lastSegment = this._segments[this._segments.length - 1]!;
    if (!ext) {
      const idx = lastSegment.lastIndexOf(".");
      if (idx !== -1) {
        return lastSegment.slice(0, idx);
      }
    }
    return lastSegment;
  }
}
