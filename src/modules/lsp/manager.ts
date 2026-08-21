import type { EditorView } from "@codemirror/view";
import type { Text } from "@codemirror/state";
import { setDiagnostics, type Diagnostic as CmDiagnostic } from "@codemirror/lint";
import { LSPClient } from "@codemirror/lsp-client";
import { adaptTransport, type ServerRequestHandler } from "./transport-adapter";
import { MinicodeWorkspace, type DisplayFileFn } from "./workspace";
import { trustHtml } from "./sanitize";
import type {
  CompletionItem,
  CompletionList,
  Diagnostic,
  DidChangeTextDocumentParams,
  DidCloseTextDocumentParams,
  DidOpenTextDocumentParams,
  Hover,
  Position,
  PublishDiagnosticsParams,
} from "./types";
import { toUri as toUriFn } from "./types";
import type { LogContext } from "../log/log";
import type { LspServerConfig } from "../../mini-code";

interface OpenDoc {
  version: number;
  view: EditorView;
  ext: string;
}

interface LspEntry {
  id: number;
  client: LSPClient | null;
  /** Whether this is the primary server for its extensions. */
  primary: boolean;
  /** Extensions this entry serves (e.g. [".ts", ".tsx", ".js", ".jsx"]). */
  extensions: string[];
  awaiter: Promise<void>;
}

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

export function languageIdForExt(ext: string): string {
  return EXT_TO_LANGUAGE_ID[ext] ?? ext;
}

/** Extensions whose hover tooltips are rendered by minicode's custom impl. */
const CUSTOM_HOVER_EXTS = new Set([
  ".ts",
  ".tsx",
  ".mts",
  ".mtsx",
  ".cts",
  ".ctsx",
  ".js",
  ".jsx",
  ".mjs",
  ".mjsx",
  ".cjs",
  ".cjsx",
]);

/**
 * Fallback file patterns to watch per language extension, for servers that
 * don't dynamically register `workspace/didChangeWatchedFiles` via
 * `client/registerCapability`. tsserver is the primary example — it accepts
 * `didChangeWatchedFiles` notifications but never registers for them.
 *
 * Patterns are relative to the workspace root and use simple `*` globs.
 */
const FALLBACK_WATCHED_PATTERNS: Record<string, string[]> = {
  ts: ["tsconfig.json", "tsconfig.*.json", "jsconfig.json"],
  tsx: ["tsconfig.json", "tsconfig.*.json", "jsconfig.json"],
  cts: ["tsconfig.json", "tsconfig.*.json", "jsconfig.json"],
  mts: ["tsconfig.json", "tsconfig.*.json", "jsconfig.json"],
  js: ["jsconfig.json", "package.json"],
  jsx: ["jsconfig.json", "package.json"],
  mjs: ["jsconfig.json", "package.json"],
  cjs: ["jsconfig.json", "package.json"],
};

/** Convert a glob pattern (supporting `**`, `*`, `?`) into a RegExp. */
function globToRegExp(pattern: string): RegExp {
  let re = "";
  let i = 0;
  while (i < pattern.length) {
    const c = pattern.charAt(i);
    if (c === "*" && pattern.charAt(i + 1) === "*") {
      // `**` — match across path segments (including zero segments)
      // Consume an optional following `/` so `**/` matches zero-or-more dirs.
      i += 2;
      if (pattern.charAt(i) === "/") {
        re += "(?:.*/)?";
        i++;
      } else {
        re += ".*";
      }
    } else if (c === "*") {
      // `*` — match within a single segment (no `/`)
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

/** Test if a relative file path matches any of the glob patterns. */
function matchesAnyPattern(relPath: string, patterns: RegExp[]): boolean {
  const basename = relPath.split("/").pop() ?? relPath;
  return patterns.some((re) => re.test(basename) || re.test(relPath));
}

function normalizeExt(ext: string) {
  if (ext.length === 0) return ext;
  if (!ext.startsWith(".")) {
    ext = "." + ext;
  }
  return ext;
}

interface WatchedFilesRegistration {
  patterns: RegExp[];
  client: LSPClient;
}

export class LspManager {
  private clients = new Map<string, LspEntry[]>();
  private documents = new Map<string, OpenDoc>();
  private diagnosticsByUri = new Map<string, Map<LSPClient, Diagnostic[]>>();
  private watchedFiles: WatchedFilesRegistration[] = [];
  private nextLspID = 1;

  constructor(
    private servers: LspServerConfig[],
    private rootUri: string,
    private displayFileFn: DisplayFileFn,
    private logs?: LogContext,
  ) {
    this.servers.forEach((c) => {
      c.extensions = c.extensions.map(normalizeExt);
    });
  }

  hasLsp(ext: string | undefined): boolean {
    if (!ext) return false;
    ext = normalizeExt(ext);
    return this.clients.has(ext) || this.servers.some((s) => s.extensions.includes(ext));
  }

  /** Whether minicode's custom hover tooltip should be used for this file. */
  useCustomHover(ext: string | undefined): boolean {
    if (!ext) return false;
    ext = normalizeExt(ext);
    return CUSTOM_HOVER_EXTS.has(ext);
  }

  getClientsFor(ext: string): LSPClient[] {
    ext = normalizeExt(ext);
    const entries = this.clients.get(ext);
    return (entries ?? []).map((e) => e.client).filter((v) => !!v);
  }

  /**
   * Eagerly creates the LSP clients for a file extension (if not already
   * created) and returns the primary client. The client starts initializing
   * immediately; `client.plugin(...)` may be called on the returned client
   * even before it is connected — its `didOpen` waits on `client.initializing`.
   */
  ensurePrimaryClient(ext: string): LSPClient | null {
    ext = normalizeExt(ext);
    const entries = this.getEntries(ext);
    const primary = entries.find((e) => e.primary);
    return primary?.client ?? null;
  }

  private getEntries(ext: string): LspEntry[] {
    ext = normalizeExt(ext);

    const entries = this.clients.get(ext);
    if (entries) return entries;

    const configs = this.servers.filter((s) => s.extensions.includes(ext));

    const newEntries = configs.map((c, idx) => {
      this.logs?.info(`Creating LSP client for [${c.extensions.join(", ")}]`);
      const entry = this.createServerEntry(c, idx === 0);
      return entry;
    });

    for (const entry of newEntries) {
      for (const entryExt of entry.extensions) {
        const list = this.clients.get(entryExt) ?? [];
        if (list.some((lsp) => lsp === entry)) continue;
        list.push(entry);
        this.clients.set(entryExt, list);
      }
    }

    return newEntries;
  }

  private createServerEntry(server: LspServerConfig, isPrimary: boolean): LspEntry {
    const client = new LSPClient({
      rootUri: this.rootUri,
      timeout: 60000,
      sanitizeHTML: (html) => trustHtml(html) as unknown as string,
      workspace: isPrimary ? (c) => new MinicodeWorkspace(c, this.displayFileFn) : undefined,
      extensions: [
        {
          clientCapabilities: {
            workspace: {
              didChangeConfiguration: { dynamicRegistration: true },
              didChangeWatchedFiles: { dynamicRegistration: true },
            },
          },
        },
      ],
      notificationHandlers: {
        "textDocument/publishDiagnostics": (c, params) => {
          const p = params as PublishDiagnosticsParams;
          this.logs?.debug(
            `LSP publishDiagnostics for "${p.uri}": ${p.diagnostics.length} diagnostics`,
          );
          const doc = this.documents.get(p.uri);
          if (doc) {
            this.updateDiagnostics(p.uri, c, p.diagnostics as Diagnostic[]);
          } else {
            this.logs?.debug(`LSP publishDiagnostics: no open document for "${p.uri}"`);
          }
          return true;
        },
        "window/logMessage": (_c, params) => {
          const p = params as { type: number; message: string };
          if (p.type <= 1) this.logs?.error(`LSP window/logMessage`, p.message);
          else if (p.type === 2) this.logs?.warn(`LSP window/logMessage`, p.message);
          else this.logs?.debug(`LSP window/logMessage`, p.message);
          return true;
        },
        "window/showMessage": (_c, params) => {
          const p = params as { type: number; message: string };
          if (p.type <= 1) this.logs?.error(`LSP window/showMessage`, p.message);
          else if (p.type === 2) this.logs?.warn(`LSP window/showMessage`, p.message);
          else this.logs?.debug(`LSP window/showMessage`, p.message);
          return true;
        },
      },
      unhandledNotification: (_c, method, _params) => {
        this.logs?.debug(`LSP unhandled notification: ${method}`);
      },
    });
    const entry: LspEntry = {
      id: this.nextLspID++,
      client,
      primary: isPrimary,
      extensions: server.extensions.slice(),
      awaiter: null as any,
    };
    const serverRequestHandler: ServerRequestHandler = (method, params) => {
      return this.handleServerRequest(client, method, params);
    };
    entry.awaiter = (async () => {
      try {
        this.logs?.debug(`LSP[${entry.id}] awaiting transport`);
        const transport = await server.transport({ rootUri: this.rootUri });
        const adapter = adaptTransport(transport, this.logs, serverRequestHandler);
        this.logs?.debug(`LSP[${entry.id}] connecting`);
        client.connect(adapter);
        await client.initializing;
        this.logs?.info(`LSP[${entry.id}] initialized`);
        for (const ext of entry.extensions) {
          this.setupFallbackFileWatching(client, ext);
        }
      } catch (err) {
        this.logs?.error(`Failed to initialize LSP[${entry.id}]`, err);
      }
    })();
    return entry;
  }

  /**
   * Handles server-initiated requests. Currently only `client/registerCapability`
   * is processed — when the server registers `workspace/didChangeWatchedFiles`,
   * the watcher glob patterns are parsed and added to the file-watching
   * registry. All other requests are acknowledged with `result: null`.
   */
  private handleServerRequest(_client: LSPClient, method: string, params: unknown): unknown {
    if (method === "client/registerCapability") {
      const p = params as {
        registrations: Array<{
          id: string;
          method: string;
          registerOptions?: { watchers?: Array<{ globPattern?: string }> };
        }>;
      };
      for (const reg of p?.registrations ?? []) {
        if (reg.method === "workspace/didChangeWatchedFiles") {
          const globs = (reg.registerOptions?.watchers ?? [])
            .map((w): string | null => {
              const g = w.globPattern as unknown;
              if (!g) return null;
              if (typeof g === "string") return g;
              if (typeof g === "object" && g !== null && "pattern" in g) {
                const p = (g as { pattern: unknown }).pattern;
                if (typeof p === "string") return p;
              }
              return null;
            })
            .filter((g): g is string => g !== null);
          if (globs.length > 0) {
            this.logs?.debug(`LSP: server registered file watchers: ${globs.join(", ")}`);
            this.registerWatchedFiles(_client, globs);
          }
        } else {
          this.logs?.debug(`LSP: server registered capability "${reg.method}"`);
        }
      }
    }
    return null;
  }

  /**
   * Registers fallback file patterns for a client based on the file
   * extension. Used for servers (like tsserver) that don't dynamically
   * register `workspace/didChangeWatchedFiles`.
   */
  private setupFallbackFileWatching(client: LSPClient, ext: string): void {
    ext = normalizeExt(ext);

    const patterns = FALLBACK_WATCHED_PATTERNS[ext];
    if (patterns && patterns.length > 0) {
      this.logs?.debug(`LSP[${ext}]: registering fallback file watchers: ${patterns.join(", ")}`);
      this.registerWatchedFiles(client, patterns);
    }
  }

  private registerWatchedFiles(client: LSPClient, globs: string[]): void {
    const patterns = globs.map(globToRegExp);
    this.watchedFiles.push({ patterns, client });
  }

  /**
   * Called by the host (MiniCodeContext) when a file change is detected by the
   * filesystem watcher. Forwards `workspace/didChangeWatchedFiles`
   * notifications to any LSP client whose registered patterns match the
   * changed file.
   *
   * @param relPath - Path relative to the workspace root.
   * @param eventType - `"change"` or `"rename"` (create/delete/rename).
   */
  onFileChange(relPath: string, eventType: string): void {
    if (this.watchedFiles.length === 0) return;
    const uri = toUriFn(relPath);
    const lspType = eventType === "change" ? 2 : 3; // 2=Changed, 3=Created/Deleted
    for (const reg of this.watchedFiles) {
      if (matchesAnyPattern(relPath, reg.patterns)) {
        try {
          reg.client.notification("workspace/didChangeWatchedFiles", {
            changes: [{ uri, type: lspType }],
          });
        } catch (err) {
          this.logs?.warn("LSP: failed to send didChangeWatchedFiles", err);
        }
      }
    }
  }

  async openDocument(
    ext: string,
    filePath: string,
    content: string,
    view: EditorView,
  ): Promise<void> {
    ext = normalizeExt(ext);

    const entries = this.getEntries(ext);
    if (entries.length === 0) return;

    const uri = toUriFn(filePath);
    this.documents.set(uri, { version: 0, view, ext });
    this.logs?.debug(`LSP open document "${filePath}" (${ext})`);

    try {
      await Promise.all(entries.map((e) => e.awaiter));
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
      // The primary client is notified of opens through its workspace
      // (triggered by `client.plugin(...)`), so only sync secondaries here.
      if (!entry.client || entry.primary) continue;

      try {
        entry.client.notification("textDocument/didOpen", params);
        this.requestDiagnostics(entry.client, uri).catch((err) => {
          this.logs?.debug(`LSP diagnostic pull failed for "${filePath}"`, err);
        });
      } catch (err) {
        this.logs?.warn(`LSP didOpen notify failed for "${filePath}"`, err);
      }
    }

    // Pull diagnostics from the primary as well — the server may not push on open.
    const primary = entries.find((e) => e.primary);
    if (primary?.client) {
      this.requestDiagnostics(primary.client, uri).catch(() => {});
    }
  }

  private async requestDiagnostics(client: LSPClient, uri: string): Promise<void> {
    try {
      const result = await client.request<
        { textDocument: { uri: string } },
        {
          kind: "full" | "incremental";
          items?: Array<{
            range: { start: Position; end: Position };
            severity?: number;
            message: string;
            source?: string;
            code?: string | number;
          }>;
        }
      >("textDocument/diagnostic", { textDocument: { uri } });
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

    for (const entry of entries) {
      if (!entry.client) continue;

      try {
        if (entry.primary) {
          // The primary client syncs through its workspace, which sends
          // didChange based on the accumulated unsynced changes.
          entry.client.sync();
        } else {
          const params: DidChangeTextDocumentParams = {
            textDocument: { uri, version: doc.version },
            contentChanges: [{ text: content }],
          };
          entry.client.notification("textDocument/didChange", params);
        }
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
      // Primary close is handled by the LSPPlugin/workspace on view destroy.
      if (!entry.client || entry.primary) continue;

      try {
        entry.client.notification("textDocument/didClose", params);
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
    ext = normalizeExt(ext);

    const entries = this.getEntries(ext);
    if (entries.length === 0) return null;

    await Promise.all(entries.map((e) => e.awaiter));

    const lspPos = cmToLspPos(doc, pos);
    const uri = toUriFn(filePath);

    const primary = entries.find((e) => e.primary);
    if (primary?.client) primary.client.sync();

    const results = await Promise.all(
      entries.map(async (entry) => {
        if (!entry.client) return null;

        try {
          const result = await entry.client.request<
            { textDocument: { uri: string }; position: Position },
            CompletionList | CompletionItem[]
          >("textDocument/completion", { textDocument: { uri }, position: lspPos });
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
    ext = normalizeExt(ext);

    const entries = this.getEntries(ext);
    if (entries.length === 0) return null;

    await Promise.all(entries.map((e) => e.awaiter));

    const lspPos = cmToLspPos(doc, pos);
    const uri = toUriFn(filePath);

    const primary = entries.find((e) => e.primary);
    if (primary?.client) primary.client.sync();

    const results = await Promise.all(
      entries.map(async (entry) => {
        if (!entry.client) return null;

        try {
          return await entry.client.request<
            { textDocument: { uri: string }; position: Position },
            Hover | null
          >("textDocument/hover", {
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

  private updateDiagnostics(uri: string, client: LSPClient, diagnostics: Diagnostic[]): void {
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
      this.logs?.debug(`LSP diag: "${d.message}" from=${from} to=${to} severity=${d.severity}`);
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
        if (entry?.client) {
          entry.client.disconnect();
        }
      }
    }
    this.clients.clear();
    this.documents.clear();
    this.diagnosticsByUri.clear();
    this.watchedFiles = [];
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
