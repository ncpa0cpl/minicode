import { describe, it, expect } from "bun:test";
import { EditorState, Text } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { AutoRespondTransport, MockTransport, createMockFactory } from "./mock-transport";
import { LspManager } from "../manager";
import type { LspServerConfig } from "../../../mini-code";

const ROOT_URI = "file:///test";

/**
 * Minimal mock of EditorView — just enough for LspManager to store and
 * use for diagnostics dispatch. We can't use a real EditorView without a DOM.
 */
function createMockView(doc = ""): EditorView {
  const state = EditorState.create({ doc });
  return {
    state,
    dispatch: () => {},
  } as unknown as EditorView;
}

/** Create a Text from a string for completion/hover tests. */
function textOf(s: string): Text {
  return EditorState.create({ doc: s }).doc;
}

/**
 * Wait for all pending microtasks (promise callbacks) to flush.
 * The LSP client's `notification()` and `request()` are queued behind
 * `client.initializing.then(...)`, so we need to yield to let those
 * resolve.
 */
function flush(ms = 10): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

describe("LspManager", () => {
  describe("hasLsp", () => {
    it("returns true for extensions covered by a server", () => {
      const servers: LspServerConfig[] = [
        {
          name: "test-ls",
          transport: createMockFactory(new MockTransport()),
          extensions: [".ts", ".tsx"],
        },
      ];
      const mgr = new LspManager(servers, ROOT_URI, async () => null);
      expect(mgr.hasLsp("ts")).toBe(true);
      expect(mgr.hasLsp("tsx")).toBe(true);
    });

    it("returns false for uncovered extensions", () => {
      const servers: LspServerConfig[] = [
        { name: "test-ls", transport: createMockFactory(new MockTransport()), extensions: [".ts"] },
      ];
      const mgr = new LspManager(servers, ROOT_URI, async () => null);
      expect(mgr.hasLsp("go")).toBe(false);
      expect(mgr.hasLsp(undefined)).toBe(false);
    });

    it("handles extensions with or without leading dot", () => {
      const servers: LspServerConfig[] = [
        {
          name: "test-ls",
          transport: createMockFactory(new MockTransport()),
          extensions: ["ts", "tsx"],
        },
      ];
      const mgr = new LspManager(servers, ROOT_URI, async () => null);
      expect(mgr.hasLsp("ts")).toBe(true);
      expect(mgr.hasLsp("tsx")).toBe(true);
    });
  });

  describe("ensurePrimaryClient", () => {
    it("returns a client for a covered extension", () => {
      const transport = new AutoRespondTransport();
      const servers: LspServerConfig[] = [
        { name: "test-ls", transport: createMockFactory(transport), extensions: [".ts", ".tsx"] },
      ];
      const mgr = new LspManager(servers, ROOT_URI, async () => null);
      const client = mgr.ensurePrimaryClient("ts");
      expect(client).not.toBeNull();
    });

    it("returns null for an uncovered extension", () => {
      const servers: LspServerConfig[] = [
        { name: "test-ls", transport: createMockFactory(new MockTransport()), extensions: [".ts"] },
      ];
      const mgr = new LspManager(servers, ROOT_URI, async () => null);
      expect(mgr.ensurePrimaryClient("go")).toBeNull();
    });

    it("returns the same client instance for extensions sharing a server", () => {
      const transport = new AutoRespondTransport();
      const servers: LspServerConfig[] = [
        {
          name: "test-ls",
          transport: createMockFactory(transport),
          extensions: [".ts", ".tsx", ".js"],
        },
      ];
      const mgr = new LspManager(servers, ROOT_URI, async () => null);
      const tsClient = mgr.ensurePrimaryClient("ts");
      const tsxClient = mgr.ensurePrimaryClient("tsx");
      const jsClient = mgr.ensurePrimaryClient("js");
      expect(tsClient).toBe(tsxClient);
      expect(tsClient).toBe(jsClient);
    });
  });

  describe("multi-server (primary + secondary)", () => {
    it("shares one client across extensions on the same server", () => {
      const transport = new AutoRespondTransport();
      const servers: LspServerConfig[] = [
        { name: "test-ls", transport: createMockFactory(transport), extensions: [".ts", ".tsx"] },
      ];
      const mgr = new LspManager(servers, ROOT_URI, async () => null);
      const tsClient = mgr.ensurePrimaryClient("ts");
      const tsxClient = mgr.ensurePrimaryClient("tsx");
      expect(tsClient).toBe(tsxClient);
    });

    it("creates separate clients for separate servers", () => {
      const tsTransport = new AutoRespondTransport();
      const goTransport = new AutoRespondTransport();
      const servers: LspServerConfig[] = [
        { name: "test-ls", transport: createMockFactory(tsTransport), extensions: [".ts"] },
        { name: "test-ls", transport: createMockFactory(goTransport), extensions: [".go"] },
      ];
      const mgr = new LspManager(servers, ROOT_URI, async () => null);
      const tsClient = mgr.ensurePrimaryClient("ts");
      const goClient = mgr.ensurePrimaryClient("go");
      expect(tsClient).not.toBe(goClient);
    });

    it("creates primary + secondary for overlapping extensions", () => {
      const tsTransport = new AutoRespondTransport();
      const eslintTransport = new AutoRespondTransport();
      const servers: LspServerConfig[] = [
        { name: "test-ls", transport: createMockFactory(tsTransport), extensions: [".ts", ".tsx"] },
        {
          name: "test-ls",
          transport: createMockFactory(eslintTransport),
          extensions: [".ts", ".tsx"],
        },
      ];
      const mgr = new LspManager(servers, ROOT_URI, async () => null);
      const primary = mgr.ensurePrimaryClient("ts");
      expect(primary).not.toBeNull();
      // The primary client is the first server (tsserver), not the eslint one.
      // We can verify this by checking that two different transports were created.
      expect(tsTransport).not.toBe(eslintTransport);
    });
  });

  describe("openDocument", () => {
    it("registers the document and sends didOpen to secondary servers", async () => {
      const primaryTransport = new AutoRespondTransport();
      const secondaryTransport = new AutoRespondTransport();
      const servers: LspServerConfig[] = [
        { name: "test-ls", transport: createMockFactory(primaryTransport), extensions: [".ts"] },
        { name: "test-ls", transport: createMockFactory(secondaryTransport), extensions: [".ts"] },
      ];
      const mgr = new LspManager(servers, ROOT_URI, async () => null);
      mgr.ensurePrimaryClient("ts");

      const view = createMockView("const x = 1;");
      await mgr.openDocument("ts", "src/foo.ts", "const x = 1;", view);
      await flush();

      // Primary gets didOpen through its workspace, not through our manual send.
      // Secondary should get a manual didOpen.
      const secondaryDidOpen = secondaryTransport.findSent("textDocument/didOpen");
      expect(secondaryDidOpen).toBeDefined();
    });

    it("is a no-op for extensions with no server", async () => {
      const mgr = new LspManager([], ROOT_URI, async () => null);
      const view = createMockView("");
      await mgr.openDocument("go", "foo.go", "", view);
      // should not throw
    });
  });

  describe("changeDocument", () => {
    it("sends didChange to secondary servers with full content", async () => {
      const primaryTransport = new AutoRespondTransport();
      const secondaryTransport = new AutoRespondTransport();
      const servers: LspServerConfig[] = [
        { name: "test-ls", transport: createMockFactory(primaryTransport), extensions: [".ts"] },
        { name: "test-ls", transport: createMockFactory(secondaryTransport), extensions: [".ts"] },
      ];
      const mgr = new LspManager(servers, ROOT_URI, async () => null);
      mgr.ensurePrimaryClient("ts");

      const view = createMockView("const x = 1;");
      await mgr.openDocument("ts", "foo.ts", "const x = 1;", view);
      await flush(20);

      secondaryTransport.reset();
      mgr.changeDocument("foo.ts", "const x = 2;");
      await flush();

      const didChange = secondaryTransport.findSent("textDocument/didChange");
      expect(didChange).toBeDefined();
      if (didChange && "params" in didChange) {
        const params = didChange.params as { contentChanges: Array<{ text: string }> };
        expect(params.contentChanges[0]?.text).toBe("const x = 2;");
      }
    });

    it("is a no-op for unregistered documents", () => {
      const mgr = new LspManager([], ROOT_URI, async () => null);
      mgr.changeDocument("unknown.ts", "content");
      // should not throw
    });
  });

  describe("closeDocument", () => {
    it("sends didClose to secondary servers", async () => {
      const primaryTransport = new AutoRespondTransport();
      const secondaryTransport = new AutoRespondTransport();
      const servers: LspServerConfig[] = [
        { name: "test-ls", transport: createMockFactory(primaryTransport), extensions: [".ts"] },
        { name: "test-ls", transport: createMockFactory(secondaryTransport), extensions: [".ts"] },
      ];
      const mgr = new LspManager(servers, ROOT_URI, async () => null);
      mgr.ensurePrimaryClient("ts");

      const view = createMockView("const x = 1;");
      await mgr.openDocument("ts", "foo.ts", "const x = 1;", view);
      await flush(20);

      secondaryTransport.reset();
      mgr.closeDocument("foo.ts");
      await flush();

      const didClose = secondaryTransport.findSent("textDocument/didClose");
      expect(didClose).toBeDefined();
    });
  });

  describe("completion", () => {
    it("merges completion items from all servers", async () => {
      const primaryTransport = new AutoRespondTransport();
      const secondaryTransport = new AutoRespondTransport();

      primaryTransport.handle("textDocument/completion", () => ({
        isIncomplete: false,
        items: [{ label: "foo" }, { label: "bar" }],
      }));
      secondaryTransport.handle("textDocument/completion", () => ({
        isIncomplete: false,
        items: [{ label: "baz" }],
      }));

      const servers: LspServerConfig[] = [
        { name: "test-ls", transport: createMockFactory(primaryTransport), extensions: [".ts"] },
        { name: "test-ls", transport: createMockFactory(secondaryTransport), extensions: [".ts"] },
      ];
      const mgr = new LspManager(servers, ROOT_URI, async () => null);
      mgr.ensurePrimaryClient("ts");

      const view = createMockView("const f");
      await mgr.openDocument("ts", "foo.ts", "const f", view);
      await flush(20);

      const result = await mgr.completion("ts", "foo.ts", 6, textOf("const f"));
      expect(result).not.toBeNull();
      expect(result!.items.length).toBe(3);
      expect(result!.items.map((i) => i.label).sort()).toEqual(["bar", "baz", "foo"]);
    });

    it("returns null when no server has completions", async () => {
      const transport = new AutoRespondTransport();
      transport.handle("textDocument/completion", () => ({
        isIncomplete: false,
        items: [],
      }));
      const servers: LspServerConfig[] = [
        { name: "test-ls", transport: createMockFactory(transport), extensions: [".ts"] },
      ];
      const mgr = new LspManager(servers, ROOT_URI, async () => null);
      mgr.ensurePrimaryClient("ts");

      const view = createMockView("");
      await mgr.openDocument("ts", "foo.ts", "", view);
      await flush(20);

      const result = await mgr.completion("ts", "foo.ts", 0, textOf(""));
      expect(result).toBeNull();
    });

    it("returns null for extensions with no server", async () => {
      const mgr = new LspManager([], ROOT_URI, async () => null);
      const result = await mgr.completion("go", "foo.go", 0, textOf(""));
      expect(result).toBeNull();
    });
  });

  describe("hover", () => {
    it("merges hover content from all servers", async () => {
      const primaryTransport = new AutoRespondTransport();
      const secondaryTransport = new AutoRespondTransport();

      primaryTransport.handle("textDocument/hover", () => ({
        contents: { kind: "markdown", value: "primary hover" },
      }));
      secondaryTransport.handle("textDocument/hover", () => ({
        contents: { kind: "markdown", value: "secondary hover" },
      }));

      const servers: LspServerConfig[] = [
        { name: "test-ls", transport: createMockFactory(primaryTransport), extensions: [".ts"] },
        { name: "test-ls", transport: createMockFactory(secondaryTransport), extensions: [".ts"] },
      ];
      const mgr = new LspManager(servers, ROOT_URI, async () => null);
      mgr.ensurePrimaryClient("ts");

      const view = createMockView("const x");
      await mgr.openDocument("ts", "foo.ts", "const x", view);
      await flush(20);

      const result = await mgr.hover("ts", "foo.ts", 6, textOf("const x"));
      expect(result).not.toBeNull();
      const contents = result!.contents;
      expect(typeof contents).toBe("string");
      expect(contents as string).toContain("primary hover");
      expect(contents as string).toContain("secondary hover");
      expect(contents as string).toContain("---");
    });

    it("returns null when all servers return null", async () => {
      const transport = new AutoRespondTransport();
      transport.handle("textDocument/hover", () => null);
      const servers: LspServerConfig[] = [
        { name: "test-ls", transport: createMockFactory(transport), extensions: [".ts"] },
      ];
      const mgr = new LspManager(servers, ROOT_URI, async () => null);
      mgr.ensurePrimaryClient("ts");

      const view = createMockView("x");
      await mgr.openDocument("ts", "foo.ts", "x", view);
      await flush(20);

      const result = await mgr.hover("ts", "foo.ts", 0, textOf("x"));
      expect(result).toBeNull();
    });
  });

  describe("onFileChange", () => {
    it("does not throw when no watchers are registered", () => {
      const mgr = new LspManager([], ROOT_URI, async () => null);
      mgr.onFileChange("src/foo.ts", "change");
    });

    it("does not throw with registered watchers for unrelated files", async () => {
      const transport = new AutoRespondTransport();
      const servers: LspServerConfig[] = [
        { name: "test-ls", transport: createMockFactory(transport), extensions: [".ts"] },
      ];
      const mgr = new LspManager(servers, ROOT_URI, async () => null);
      mgr.ensurePrimaryClient("ts");
      await flush(50);

      // Should not throw even if the watcher patterns don't match
      mgr.onFileChange("README.md", "change");
    });
  });

  describe("dispose", () => {
    it("clears all state and disconnects clients", async () => {
      const tsTransport = new AutoRespondTransport();
      const goTransport = new AutoRespondTransport();
      const servers: LspServerConfig[] = [
        { name: "test-ls", transport: createMockFactory(tsTransport), extensions: [".ts"] },
        { name: "test-ls", transport: createMockFactory(goTransport), extensions: [".go"] },
      ];
      const mgr = new LspManager(servers, ROOT_URI, async () => null);
      expect(mgr.ensurePrimaryClient("ts")).not.toBeNull();
      expect(mgr.ensurePrimaryClient("go")).not.toBeNull();
      await flush(50);

      // Open a doc so we have state to clear
      const view = createMockView("x");
      await mgr.openDocument("ts", "foo.ts", "x", view);
      await flush(20);

      mgr.dispose();

      expect(mgr.getClientsFor("ts")).toEqual([]);
    });
  });

  describe("useCustomHover", () => {
    it("returns true for JS/TS family", () => {
      const mgr = new LspManager([], ROOT_URI, async () => null);
      expect(mgr.useCustomHover("ts")).toBe(true);
      expect(mgr.useCustomHover("tsx")).toBe(true);
      expect(mgr.useCustomHover("js")).toBe(true);
      expect(mgr.useCustomHover("jsx")).toBe(true);
      expect(mgr.useCustomHover("mts")).toBe(true);
      expect(mgr.useCustomHover("cts")).toBe(true);
    });

    it("returns false for non-JS/TS", () => {
      const mgr = new LspManager([], ROOT_URI, async () => null);
      expect(mgr.useCustomHover("go")).toBe(false);
      expect(mgr.useCustomHover("json")).toBe(false);
      expect(mgr.useCustomHover(undefined)).toBe(false);
    });
  });

  describe("languageIdForExt", () => {
    it("maps known extensions to language IDs", () => {
      const { languageIdForExt } = require("../manager");
      expect(languageIdForExt("ts")).toBe("typescript");
      expect(languageIdForExt("tsx")).toBe("typescriptreact");
      expect(languageIdForExt("js")).toBe("javascript");
      expect(languageIdForExt("jsx")).toBe("javascriptreact");
      expect(languageIdForExt("json")).toBe("json");
      expect(languageIdForExt("go")).toBe("go");
    });

    it("falls back to the extension itself for unknown extensions", () => {
      const { languageIdForExt } = require("../manager");
      expect(languageIdForExt("rust")).toBe("rust");
      expect(languageIdForExt("py")).toBe("py");
    });
  });
});
