import { describe, it, expect } from "bun:test";
import { Path } from "./path";

describe("Path", () => {
  it(".relative()", () => {
    expect(Path.from("/root/src/foo.ts").relative("/root", false).toString()).toEqual("src/foo.ts");
    expect(Path.from("/root/src/foo.ts").relative("/root/src", false).toString()).toEqual("foo.ts");
    expect(Path.from("/root/src/foo/bar/baz.ts").relative("/root", false).toString()).toEqual(
      "src/foo/bar/baz.ts",
    );
    expect(
      Path.from("/root/src/foo/bar/baz.ts").relative("/root/src/foo", false).toString(),
    ).toEqual("bar/baz.ts");
    expect(Path.from("/root/a/x/y").relative("/root/a/b/c", false).toString()).toEqual("../../x/y");
    expect(Path.from("/root/a/x/y").relative("/root/a/x/c", false).toString()).toEqual("../y");
    expect(Path.from("/root").relative("/root/src", false).toString()).toEqual("..");
    expect(Path.from("/root").relative("/root", false).toString()).toEqual("");
  });
});
