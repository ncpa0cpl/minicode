import type { LspMessage, LspTransport, LspTransportContext, LspTransportFactory } from "../types";

/**
 * A mock LSP transport that records all sent messages and allows injecting
 * responses from the "server" side. Messages are exchanged as parsed JSON-RPC
 * objects (matching minicode's `LspTransport` interface, not the string-based
 * `Transport` from `@codemirror/lsp-client`).
 */
export class MockTransport implements LspTransport {
  sent: LspMessage[] = [];
  private handler: ((msg: LspMessage) => void) | null = null;
  private closed = false;

  send(message: LspMessage): void {
    this.sent.push(message);
    if (this.onSend) this.onSend(message);
  }

  /** Optional hook to inspect/intercept outgoing messages in real time. */
  onSend: ((msg: LspMessage) => void) | null = null;

  onMessage(handler: (message: LspMessage) => void): () => void {
    this.handler = handler;
    return () => {
      this.handler = null;
    };
  }

  close(): void {
    this.closed = true;
  }

  isClosed() {
    return this.closed;
  }

  /**
   * Inject a message from the "server" into the transport — the connected
   * LSPClient will receive it as if the server sent it.
   */
  receive(message: LspMessage): void {
    if (this.handler) {
      this.handler(message);
    }
  }

  /** Respond to a request with the given result. */
  respondTo(requestId: number | string, result: unknown): void {
    this.receive({ jsonrpc: "2.0", id: requestId, result });
  }

  /** Respond to a request with an error. */
  errorTo(requestId: number | string, error: { code: number; message: string }): void {
    this.receive({ jsonrpc: "2.0", id: requestId, error });
  }

  /** Send a notification from the "server". */
  notify(method: string, params: unknown): void {
    this.receive({ jsonrpc: "2.0", method, params });
  }

  /** Find the first sent message matching a method. */
  findSent(method: string): LspMessage | undefined {
    return this.sent.find((m) => "method" in m && m.method === method);
  }

  /** Find all sent messages matching a method. */
  findAllSent(method: string): LspMessage[] {
    return this.sent.filter((m) => "method" in m && m.method === method);
  }

  /** Clear recorded messages (useful between test phases). */
  reset(): void {
    this.sent = [];
  }
}

/**
 * Create a factory that returns a pre-made mock transport. The transport
 * is accessible via `.transport` for inspection and injecting responses.
 */
export function createMockFactory(transport: MockTransport): LspTransportFactory {
  return (_ctx: LspTransportContext) => transport;
}

/**
 * A more advanced mock that auto-responds to `initialize` and records
 * subsequent requests for easy assertion.
 */
export class AutoRespondTransport extends MockTransport {
  private nextId = 100;
  private requestHandlers: Record<string, (params: unknown) => unknown> = {};

  constructor() {
    super();
    this.onSend = (msg) => {
      if (!("method" in msg)) return;
      const req = msg as { id?: number | string; method: string; params?: unknown };
      if (req.id === undefined) return; // notification, not request

      // Auto-respond to initialize
      if (req.method === "initialize") {
        this.respondTo(req.id, {
          capabilities: {
            textDocumentSync: { openClose: true, change: 2, save: true },
            completionProvider: true,
            hoverProvider: true,
            diagnosticProvider: true,
          },
        });
        return;
      }

      // Check for registered handler
      const handler = this.requestHandlers[req.method];
      if (handler) {
        try {
          const result = handler(req.params);
          this.respondTo(req.id, result);
        } catch (err) {
          this.errorTo(req.id, { code: -32603, message: String(err) });
        }
      }
    };
  }

  /** Register a handler for a specific request method. */
  handle(method: string, fn: (params: unknown) => unknown): this {
    this.requestHandlers[method] = fn;
    return this;
  }
}
