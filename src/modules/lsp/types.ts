/* LSP JSON-RPC 2.0 message types */

export interface LspRequest {
  jsonrpc: "2.0";
  id: number | string;
  method: string;
  params?: unknown;
}

export interface LspResponse {
  jsonrpc: "2.0";
  id: number | string;
  result?: unknown;
  error?: LspError;
}

export interface LspNotification {
  jsonrpc: "2.0";
  method: string;
  params?: unknown;
}

export type LspMessage = LspRequest | LspResponse | LspNotification;

export interface LspError {
  code: number;
  message: string;
  data?: unknown;
}

/* Transport interface — user implements this to connect to their LSP backend */

export interface LspTransport {
  send(message: LspMessage): void;
  onMessage(handler: (message: LspMessage) => void): () => void;
  close(): void;
}

export interface LspTransportContext {
  rootUri: string;
}

export type LspTransportFactory = (ctx: LspTransportContext) => LspTransport;

/* LSP position types */

export interface Position {
  line: number;
  character: number;
}

export interface Range {
  start: Position;
  end: Position;
}

export interface Location {
  uri: string;
  range: Range;
}

/* Diagnostics */

export type DiagnosticSeverity = 1 | 2 | 3 | 4;

export interface Diagnostic {
  range: Range;
  severity?: DiagnosticSeverity;
  code?: number | string;
  source?: string;
  message: string;
}

export interface PublishDiagnosticsParams {
  uri: string;
  diagnostics: Diagnostic[];
  version?: number;
}

/* Completion */

export interface CompletionItem {
  label: string;
  kind?: number;
  detail?: string;
  documentation?: string | MarkupContent;
  insertText?: string;
  insertTextFormat?: number;
  sortText?: string;
  filterText?: string;
}

export interface CompletionList {
  isIncomplete: boolean;
  items: CompletionItem[];
}

export interface CompletionParams {
  textDocument: { uri: string };
  position: Position;
  context?: { triggerKind: number; triggerCharacter?: string };
}

/* Hover */

export type MarkupContent = { kind: "plaintext" | "markdown"; value: string };

export interface Hover {
  contents: string | MarkupContent | Array<string | MarkupContent>;
  range?: Range;
}

export interface HoverParams {
  textDocument: { uri: string };
  position: Position;
}

/* Document sync */

export interface TextDocumentItem {
  uri: string;
  languageId: string;
  version: number;
  text: string;
}

export interface DidOpenTextDocumentParams {
  textDocument: TextDocumentItem;
}

export interface DidChangeTextDocumentParams {
  textDocument: { uri: string; version: number };
  contentChanges: Array<{ text: string }>;
}

export interface DidCloseTextDocumentParams {
  textDocument: { uri: string };
}

/* Initialize */

export interface InitializeParams {
  processId: number | null;
  rootUri: string;
  capabilities: Record<string, unknown>;
  workspaceFolders?: Array<{ uri: string; name: string }>;
}

export interface InitializeResult {
  capabilities: Record<string, unknown>;
}

/* Utility */

export function toUri(path: string): string {
  const p = path.startsWith("/") ? path : "/" + path;
  return `file://${p}`;
}
