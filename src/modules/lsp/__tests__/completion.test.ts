import { describe, it, expect, beforeAll } from "bun:test";
import { EditorState } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { File } from "../../../files";

import type { CompletionItem } from "../types";

// Minimal mock manager with resolveCompletion stub
class MockManager {
  constructor(public resolvedItem: CompletionItem | null) {}
  async resolveCompletion(_ext: string, _item: CompletionItem) {
    return this.resolvedItem;
  }
}

function createMockView(initialDoc: string) {
  const state = EditorState.create({ doc: initialDoc });
  const dispatched: any[] = [];
  const view = {
    state,
    dispatch: (tr: any) => {
      dispatched.push(tr);
    },
  } as unknown as EditorView;
  return { view, dispatched };
}

let convertCompletionItem: any;

beforeAll(async () => {
  const mod = await import("../extensions");
  convertCompletionItem = mod.convertCompletionItem;
});

describe("convertCompletionItem", () => {
  it("applies fast-path edits when additionalTextEdits present", () => {
    const file = new File("test.ts", false);
    const item: CompletionItem = {
      label: "foo",
      additionalTextEdits: [
        {
          range: { start: { line: 0, character: 6 }, end: { line: 0, character: 6 } },
          newText: "import x;\n",
        },
      ],
    } as any;
    const manager = new MockManager(null);
    const { view, dispatched } = createMockView("const a;");
    const comp = convertCompletionItem(manager as any, file, item);
    // invoke apply synchronously (fast path)
    comp.apply(view, null as any, 0, 0);
    expect(dispatched).toHaveLength(1);
    const changes = dispatched[0].changes as any[];
    expect(changes).toHaveLength(2);
    expect(changes[0].insert).toBe("foo");
    expect(changes[1].insert).toBe("import x;\n");
  });

  it("resolves lazy edits when no additionalTextEdits initially", async () => {
    const file = new File("test.ts", false);
    const item: CompletionItem = { label: "bar" } as any;
    const resolved: CompletionItem = {
      label: "bar",
      additionalTextEdits: [
        {
          range: { start: { line: 0, character: 4 }, end: { line: 0, character: 4 } },
          newText: "import y;\n",
        },
      ],
    } as any;
    const manager = new MockManager(resolved);
    const { view, dispatched } = createMockView("foo");
    const comp = convertCompletionItem(manager as any, file, item);
    // apply returns a Promise for lazy path
    await (comp.apply as any)(view, null as any, 0, 0);
    // first dispatch for insert, second for resolved edits
    expect(dispatched).toHaveLength(2);
    const first = dispatched[0].changes as any;
    const second = dispatched[1].changes as any;
    expect(first.insert).toBe("bar");
    expect(second[0].insert).toBe("import y;\n");
  });
});
