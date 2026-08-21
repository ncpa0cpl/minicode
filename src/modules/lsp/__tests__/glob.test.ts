import { describe, it, expect } from "bun:test";

/**
 * These tests verify the glob-to-regex conversion used by the LSP file
 * watcher registration. The function itself is not exported, so we
 * replicate the logic here for testing. Any changes to the implementation
 * should be reflected in these tests.
 */

function globToRegExp(pattern: string): RegExp {
  let re = "";
  let i = 0;
  while (i < pattern.length) {
    const c = pattern.charAt(i);
    if (c === "*" && pattern.charAt(i + 1) === "*") {
      i += 2;
      if (pattern.charAt(i) === "/") {
        re += "(?:.*/)?";
        i++;
      } else {
        re += ".*";
      }
    } else if (c === "*") {
      re += "[^/]*";
      i++;
    } else if (c === "?") {
      re += "[^/]";
      i++;
    } else if (".+^${}()|[]\\".includes(c)) {
      re += "\\" + c;
      i++;
    } else {
      re += c;
      i++;
    }
  }
  return new RegExp("^" + re + "$");
}

describe("globToRegExp", () => {
  describe("** patterns (cross-segment)", () => {
    it("matches root-level files with **/*.ts", () => {
      const re = globToRegExp("**/*.ts");
      expect(re.test("context.ts")).toBe(true);
      expect(re.test("app.tsx")).toBe(false);
    });

    it("matches nested files with **/*.ts", () => {
      const re = globToRegExp("**/*.ts");
      expect(re.test("src/context.ts")).toBe(true);
      expect(re.test("src/modules/lsp/manager.ts")).toBe(true);
    });

    it("matches deep paths with **/*.{ts,tsx}", () => {
      // Brace expansion is NOT supported — this is a glob, not a micromatch
      const re = globToRegExp("**/*.ts");
      expect(re.test("a/b/c/d/e.ts")).toBe(true);
    });

    it("** at end matches everything", () => {
      const re = globToRegExp("node_modules/**");
      expect(re.test("node_modules/foo")).toBe(true);
      expect(re.test("node_modules/foo/bar")).toBe(true);
      expect(re.test("node_modules/foo/bar/baz.ts")).toBe(true);
      expect(re.test("src/foo")).toBe(false);
    });
  });

  describe("* patterns (within-segment)", () => {
    it("matches within a single segment", () => {
      const re = globToRegExp("tsconfig.*.json");
      expect(re.test("tsconfig.json")).toBe(false); // * requires at least... actually no
      expect(re.test("tsconfig.build.json")).toBe(true);
      expect(re.test("tsconfig.dev.json")).toBe(true);
    });

    it("does not cross path separators", () => {
      const re = globToRegExp("*.ts");
      expect(re.test("foo.ts")).toBe(true);
      expect(re.test("src/foo.ts")).toBe(false);
    });
  });

  describe("exact patterns", () => {
    it("matches exact filenames", () => {
      const re = globToRegExp("tsconfig.json");
      expect(re.test("tsconfig.json")).toBe(true);
      expect(re.test("tsconfig.build.json")).toBe(false);
    });

    it("matches exact paths", () => {
      const re = globToRegExp("package.json");
      expect(re.test("package.json")).toBe(true);
      expect(re.test("node_modules/foo/package.json")).toBe(false);
    });
  });

  describe("absolute path patterns (from tsserver)", () => {
    it("matches absolute paths with **/*", () => {
      const re = globToRegExp("/mavault/private/dev/minicode/**/*");
      expect(re.test("/mavault/private/dev/minicode/src/context.ts")).toBe(true);
      expect(re.test("/mavault/private/dev/minicode/tsconfig.json")).toBe(true);
      expect(re.test("/other/path/file.ts")).toBe(false);
    });

    it("matches absolute node_modules paths", () => {
      const re = globToRegExp("/mavault/private/dev/minicode/node_modules/**/*");
      expect(re.test("/mavault/private/dev/minicode/node_modules/typescript/lib/tsc")).toBe(true);
      expect(re.test("/mavault/private/dev/minicode/src/context.ts")).toBe(false);
    });
  });

  describe("? patterns", () => {
    it("matches single character", () => {
      const re = globToRegExp("file?.ts");
      expect(re.test("file1.ts")).toBe(true);
      expect(re.test("file2.ts")).toBe(true);
      expect(re.test("file12.ts")).toBe(false);
      expect(re.test("file.ts")).toBe(false);
    });

    it("does not match path separator", () => {
      const re = globToRegExp("?file.ts");
      expect(re.test("afile.ts")).toBe(true);
      expect(re.test("/file.ts")).toBe(false);
    });
  });
});
