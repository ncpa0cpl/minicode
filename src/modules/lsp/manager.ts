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
import type { LogContext } from "../log/log";

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

const EXT_TO_LANGUAGE_ID: Record<string, string> = {
  ts: "typescript",
  tsx: "typescriptreact",
  js: "javascript",
  jsx: "javascriptreact",
  mjs: "javascript",
  cjs: "javascript",
  json: "json",
  go: "go",
};

function languageIdForExt(ext: string): string {
  return EXT_TO_LANGUAGE_ID[ext] ?? ext;
}

export class LspManager {
  private clients = new Map<string, LspEntry[]>();
  private documents = new Map<string, OpenDoc>();
  private diagnosticsByUri = new Map<string, Map<LspClient, Diagnostic[]>>();

  constructor(
    private factories: LspFactoryConfig,
    private rootUri: string,
    private logs?: LogContext,
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
    this.logs?.info(`Creating LSP client(s) for "${key}"`);
    entries = factoryList
      .map((f, i) => {
        try {
          const transport = f({ rootUri: this.rootUri });
          const client = new LspClient(transport);
          const initialized = this.initializeClient(client, ext, i);
          return { client, initialized };
        } catch (err) {
          this.logs?.error("Failed to initialize LSP", err);
        }
      })
      .filter((v) => !!v);
    this.clients.set(key, entries);
    return entries;
  }

  private async initializeClient(client: LspClient, ext: string, idx = 0): Promise<void> {
    const params: InitializeParams = {
      processId: null,
      rootUri: this.rootUri,
      capabilities: {
        textDocument: {
          synchronization: { didOpen: true, didChange: true, didClose: true },
          completion: { completionItem: { snippet: false } },
          hover: { contentFormat: ["markdown", "plaintext"] },
          publishDiagnostics: { relatedInformation: true },
        },
        workspace: {
          workspaceFolders: true,
          configuration: true,
          didChangeConfiguration: { dynamicRegistration: true },
          didChangeWatchedFiles: { dynamicRegistration: true },
        },
      },
      workspaceFolders: [{ uri: this.rootUri, name: "root" }],
    };

    this.logs?.debug(`LSP[${ext}#${idx}] initializing`);
    try {
      await client.request<InitializeResult>("initialize", params);
      client.notify("initialized", {});
      this.logs?.info(`LSP[${ext}#${idx}] initialized`);

    client.onNotification("textDocument/publishDiagnostics", (params) => {
      const p = params as PublishDiagnosticsParams;
      this.logs?.debug(
        `LSP publishDiagnostics for "${p.uri}": ${p.diagnostics.length} diagnostics`,
      );
      const doc = this.documents.get(p.uri);
      if (doc) {
        this.updateDiagnostics(p.uri, client, p.diagnostics);
      } else {
        this.logs?.debug(`LSP publishDiagnostics: no open document for "${p.uri}"`);
      }
    });
    } catch (err) {
      this.logs?.error(`Failed to initialize LSP[${ext}#${idx}]`, err);
      throw err;
    }
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
    this.logs?.debug(`LSP open document "${filePath}" (${ext})`);

    try {
      await Promise.all(entries.map((e) => e.initialized));
    } catch (err) {
      this.logs?.warn(`LSP not ready for ".${ext}" (${filePath})`, err);
    }

    const params: DidOpenTextDocumentParams = {
      textDocument: {
        uri,
        languageId: languageIdForExt(ext),
        version: 0,
        text: content,
      },
    };
    for (const entry of entries) {
      try {
        entry.client.notify("textDocument/didOpen", params);
        // Pull diagnostics — the TS Go LSP may not push them on open
        this.requestDiagnostics(entry.client, uri).catch((err) => {
          this.logs?.debug(`LSP diagnostic pull failed for "${filePath}"`, err);
        });
      } catch (err) {
        this.logs?.warn(`LSP didOpen notify failed for "${filePath}"`, err);
      }
    }
  }

  private async requestDiagnostics(client: LspClient, uri: string): Promise<void> {
    try {
      const result = await client.request<{
        kind: "full" | "incremental";
        items?: Array<{
          range: { start: Position; end: Position };
          severity?: number;
          message: string;
          source?: string;
          code?: string | number;
        }>;
      }>("textDocument/diagnostic", { textDocument: { uri } });
      if (result?.items) {
        this.updateDiagnostics(uri, client, result.items as unknown as Diagnostic[]);
      }
    } catch {
      // server may not support diagnostic pull — fall back to push
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
      try {
        entry.client.notify("textDocument/didChange", params);
        this.requestDiagnostics(entry.client, uri).catch(() => {});
      } catch (err) {
        this.logs?.warn(`LSP didChange notify failed for "${filePath}"`, err);
      }
    }
  }

  closeDocument(filePath: string): void {
    const uri = toUriFn(filePath);
    const doc = this.documents.get(uri);
    if (!doc) return;

    this.documents.delete(uri);
    this.diagnosticsByUri.delete(uri);
    this.logs?.debug(`LSP close document "${filePath}"`);

    const entries = this.getEntries(doc.ext);
    if (entries.length === 0) return;

    const params: DidCloseTextDocumentParams = {
      textDocument: { uri },
    };
    for (const entry of entries) {
      try {
        entry.client.notify("textDocument/didClose", params);
      } catch (err) {
        this.logs?.warn(`LSP didClose notify failed for "${filePath}"`, err);
      }
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
        } catch (err) {
          this.logs?.warn(`LSP completion request failed for "${filePath}"`, err);
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

  async hover(ext: string, filePath: string, pos: number, doc: Text): Promise<Hover | null> {
    const entries = this.getEntries(ext);
    if (entries.length === 0) return null;

    await Promise.all(entries.map((e) => e.initialized));

    const lspPos = cmToLspPos(doc, pos);
    const uri = toUriFn(filePath);

    const results = await Promise.all(
      entries.map(async (entry) => {
        try {
          return await entry.client.request<Hover | null>("textDocument/hover", {
            textDocument: { uri },
            position: lspPos,
          });
        } catch (err) {
          this.logs?.warn(`LSP hover request failed for "${filePath}"`, err);
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
    this.logs?.debug(`LSP applyDiagnostics: ${diagnostics.length} diagnostics`);
    const cmDiagnostics: CmDiagnostic[] = diagnostics.map((d) => {
      const from = lspToCmPos(view.state.doc, d.range.start);
      const to = lspToCmPos(view.state.doc, d.range.end);
      this.logs?.debug(
        `LSP diag: "${d.message}" from=${from} to=${to} severity=${d.severity}`,
      );
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
    this.logs?.debug("LSP manager disposing");
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
    return contents.map((c) => (typeof c === "string" ? c : c.value)).join("\n\n");
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
