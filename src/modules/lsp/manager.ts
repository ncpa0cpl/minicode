import type { EditorView } from "@codemirror/view";
import type { Text } from "@codemirror/state";
import { setDiagnostics, type Diagnostic as CmDiagnostic } from "@codemirror/lint";
import { LspClient } from "./client";
import type {
  CompletionItem,
  CompletionList,
  Diagnostic,
  DidChangeTextDocumentParams,
  DidCloseTextDocumentParams,
  DidOpenTextDocumentParams,
  Hover,
  InitializeParams,
  InitializeResult,
  LspTransportFactory,
  Position,
  PublishDiagnosticsParams,
} from "./types";
import { toUri as toUriFn } from "./types";

interface OpenDoc {
  version: number;
  view: EditorView;
  ext: string;
}

interface LspEntry {
  client: LspClient;
  initialized: Promise<void>;
}

export type LspFactoryConfig = Record<string, LspTransportFactory | LspTransportFactory[]>;

export class LspManager {
  private clients = new Map<string, LspEntry[]>();
  private documents = new Map<string, OpenDoc>();
  private diagnosticsByUri = new Map<string, Map<LspClient, Diagnostic[]>>();

  constructor(
    private factories: LspFactoryConfig,
    private rootUri: string,
  ) {}

  hasLsp(ext: string | undefined): boolean {
    if (!ext) return false;
    return "." + ext in this.factories;
  }

  private getEntries(ext: string): LspEntry[] {
    const key = "." + ext;
    let entries = this.clients.get(key);
    if (entries) return entries;

    const factory = this.factories[key];
    if (!factory) return [];

    const factoryList = Array.isArray(factory) ? factory : [factory];
    entries = factoryList.map((f) => {
      const transport = f({ rootUri: this.rootUri });
      const client = new LspClient(transport);
      const initialized = this.initializeClient(client);
      return { client, initialized };
    });
    this.clients.set(key, entries);
    return entries;
  }

  private async initializeClient(client: LspClient): Promise<void> {
    const params: InitializeParams = {
      processId: null,
      rootUri: this.rootUri,
      capabilities: {
        textDocument: {
          synchronization: { didOpen: true, didChange: true, didClose: true },
          completion: { completionItem: { snippet: false } },
          hover: { contentFormat: ["markdown", "plaintext"] },
        },
      },
      workspaceFolders: [{ uri: this.rootUri, name: "root" }],
    };

    await client.request<InitializeResult>("initialize", params);
    client.notify("initialized", {});

    client.onNotification("textDocument/publishDiagnostics", (params) => {
      const p = params as PublishDiagnosticsParams;
      const doc = this.documents.get(p.uri);
      if (doc) {
        this.updateDiagnostics(p.uri, client, p.diagnostics);
      }
    });
  }

  async openDocument(
    ext: string,
    filePath: string,
    content: string,
    view: EditorView,
  ): Promise<void> {
    const entries = this.getEntries(ext);
    if (entries.length === 0) return;

    const uri = toUriFn(filePath);
    this.documents.set(uri, { version: 0, view, ext });

    await Promise.all(entries.map((e) => e.initialized));

    const params: DidOpenTextDocumentParams = {
      textDocument: {
        uri,
        languageId: ext,
        version: 0,
        text: content,
      },
    };
    for (const entry of entries) {
      entry.client.notify("textDocument/didOpen", params);
    }
  }

  changeDocument(filePath: string, content: string): void {
    const uri = toUriFn(filePath);
    const doc = this.documents.get(uri);
    if (!doc) return;

    const entries = this.getEntries(doc.ext);
    if (entries.length === 0) return;

    doc.version++;
    const params: DidChangeTextDocumentParams = {
      textDocument: { uri, version: doc.version },
      contentChanges: [{ text: content }],
    };
    for (const entry of entries) {
      entry.client.notify("textDocument/didChange", params);
    }
  }

  closeDocument(filePath: string): void {
    const uri = toUriFn(filePath);
    const doc = this.documents.get(uri);
    if (!doc) return;

    this.documents.delete(uri);
    this.diagnosticsByUri.delete(uri);

    const entries = this.getEntries(doc.ext);
    if (entries.length === 0) return;

    const params: DidCloseTextDocumentParams = {
      textDocument: { uri },
    };
    for (const entry of entries) {
      entry.client.notify("textDocument/didClose", params);
    }
  }

  async completion(
    ext: string,
    filePath: string,
    pos: number,
    doc: Text,
  ): Promise<CompletionList | null> {
    const entries = this.getEntries(ext);
    if (entries.length === 0) return null;

    await Promise.all(entries.map((e) => e.initialized));

    const lspPos = cmToLspPos(doc, pos);
    const uri = toUriFn(filePath);

    const results = await Promise.all(
      entries.map(async (entry) => {
        try {
          const result = await entry.client.request<CompletionList | CompletionItem[]>(
            "textDocument/completion",
            { textDocument: { uri }, position: lspPos },
          );
          if (Array.isArray(result)) {
            return { isIncomplete: false, items: result } as CompletionList;
          }
          return result;
        } catch {
          return null;
        }
      }),
    );

    const allItems: CompletionItem[] = [];
    let isIncomplete = false;
    for (const r of results) {
      if (!r) continue;
      allItems.push(...r.items);
      if (r.isIncomplete) isIncomplete = true;
    }

    if (allItems.length === 0) return null;
    return { isIncomplete, items: allItems };
  }

  async hover(
    ext: string,
    filePath: string,
    pos: number,
    doc: Text,
  ): Promise<Hover | null> {
    const entries = this.getEntries(ext);
    if (entries.length === 0) return null;

    await Promise.all(entries.map((e) => e.initialized));

    const lspPos = cmToLspPos(doc, pos);
    const uri = toUriFn(filePath);

    const results = await Promise.all(
      entries.map(async (entry) => {
        try {
          return await entry.client.request<Hover | null>(
            "textDocument/hover",
            { textDocument: { uri }, position: lspPos },
          );
        } catch {
          return null;
        }
      }),
    );

    const texts: string[] = [];
    for (const r of results) {
      if (!r) continue;
      const text = extractHoverText(r);
      if (text) texts.push(text);
    }

    if (texts.length === 0) return null;
    return { contents: texts.join("\n\n---\n\n") };
  }

  private updateDiagnostics(uri: string, client: LspClient, diagnostics: Diagnostic[]): void {
    let perClient = this.diagnosticsByUri.get(uri);
    if (!perClient) {
      perClient = new Map();
      this.diagnosticsByUri.set(uri, perClient);
    }
    perClient.set(client, diagnostics);

    const doc = this.documents.get(uri);
    if (!doc) return;

    const all: Diagnostic[] = [];
    for (const [, diags] of perClient) {
      all.push(...diags);
    }
    this.applyDiagnostics(doc.view, all);
  }

  private applyDiagnostics(view: EditorView, diagnostics: Diagnostic[]): void {
    const cmDiagnostics: CmDiagnostic[] = diagnostics.map((d) => {
      const from = lspToCmPos(view.state.doc, d.range.start);
      const to = lspToCmPos(view.state.doc, d.range.end);
      return {
        from,
        to: Math.max(to, from + 1),
        severity: lspSeverityToCm(d.severity),
        message: d.message,
        source: d.source,
      } as CmDiagnostic;
    });
    view.dispatch(setDiagnostics(view.state, cmDiagnostics));
  }

  dispose() {
    for (const [, entries] of this.clients) {
      for (const entry of entries) {
        entry.client.dispose();
      }
    }
    this.clients.clear();
    this.documents.clear();
    this.diagnosticsByUri.clear();
  }
}

export function cmToLspPos(doc: Text, pos: number): Position {
  const line = doc.lineAt(pos);
  return { line: line.number - 1, character: pos - line.from };
}

export function lspToCmPos(doc: Text, pos: Position): number {
  const line = doc.line(pos.line + 1);
  return Math.min(line.from + pos.character, line.to);
}

function extractHoverText(hover: Hover): string | null {
  const contents = hover.contents;
  if (typeof contents === "string") return contents;
  if (Array.isArray(contents)) {
    return contents
      .map((c) => (typeof c === "string" ? c : c.value))
      .join("\n\n");
  }
  if (typeof contents === "object" && "value" in contents) {
    return contents.value;
  }
  return null;
}

function lspSeverityToCm(sev: number | undefined): "error" | "warning" | "info" {
  switch (sev) {
    case 1:
      return "error";
    case 2:
      return "warning";
    case 3:
    case 4:
      return "info";
    default:
      return "warning";
  }
}
