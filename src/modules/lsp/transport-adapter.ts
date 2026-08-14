import type { Transport } from "@codemirror/lsp-client";
import type { LspMessage, LspTransport } from "./types";
import type { LogContext } from "../log/log";

/**
 * Handler for server-initiated requests. Return value is sent as the `result`
 * field of the JSON-RPC response. Return `null` to acknowledge without data.
 */
export type ServerRequestHandler = (
  method: string,
  params: unknown,
) => unknown | Promise<unknown>;

/**
 * Adapts the minicode public {@link LspTransport} (which exchanges parsed
 * JSON-RPC objects and uses an `onMessage`/`close` lifecycle) to the
 * string-based {@link Transport} interface expected by `@codemirror/lsp-client`.
 *
 * The minicode transport's `send` may be async (e.g. it lazily starts the
 * server process on first send). This adapter invokes it without awaiting —
 * the package's `Transport.send` is synchronous — and surfaces any rejection
 * via the provided logger so it is never silently lost.
 *
 * Server-initiated requests (e.g. `client/registerCapability`) are not
 * supported by `@codemirror/lsp-client`. The adapter intercepts them and
 * delegates to an optional {@link ServerRequestHandler}, then sends the
 * response back. If no handler is provided, requests are acknowledged with
 * `result: null`.
 */
export class LspTransportAdapter implements Transport {
  private subscribers = new Set<(value: string) => void>();
  private releaseOnMessage: (() => void) | null = null;

  constructor(
    private readonly transport: LspTransport,
    private readonly logs?: LogContext,
    private readonly serverRequestHandler?: ServerRequestHandler,
  ) {}

  send(message: string): void {
    let parsed: LspMessage;
    try {
      parsed = JSON.parse(message) as LspMessage;
    } catch (err) {
      this.logs?.debug("LSP transport adapter: failed to parse outgoing message", err);
      return;
    }
    try {
      const r = this.transport.send(parsed) as unknown;
      if (r && typeof (r as Promise<void>).then === "function") {
        (r as Promise<void>).catch((err) => {
          this.logs?.warn("LSP transport send failed", err);
        });
      }
    } catch (err) {
      this.logs?.warn("LSP transport send threw", err);
    }
  }

  subscribe(handler: (value: string) => void): void {
    if (this.releaseOnMessage === null) {
      this.releaseOnMessage = this.transport.onMessage((msg) => {
        if (
          msg &&
          typeof msg === "object" &&
          "id" in msg &&
          "method" in msg &&
          !("result" in msg) &&
          !("error" in msg)
        ) {
          const req = msg as { id: number | string; method: string; params?: unknown };
          this.logs?.debug(`LSP adapter: server request "${req.method}"`);
          Promise.resolve(
            this.serverRequestHandler ? this.serverRequestHandler(req.method, req.params) : null,
          )
            .then((result) => {
              try {
                this.transport.send({
                  jsonrpc: "2.0",
                  id: req.id,
                  result: result ?? null,
                } as unknown as LspMessage);
              } catch (err) {
                this.logs?.warn("LSP adapter: failed to respond to server request", err);
              }
            })
            .catch((err) => {
              this.logs?.warn(`LSP adapter: server request "${req.method}" handler threw`, err);
              try {
                this.transport.send({
                  jsonrpc: "2.0",
                  id: req.id,
                  error: { code: -32603, message: String(err) },
                } as unknown as LspMessage);
              } catch {
                // transport already failing
              }
            });
          return;
        }

        let serialized: string;
        try {
          serialized = JSON.stringify(msg);
        } catch (err) {
          this.logs?.debug("LSP transport adapter: failed to serialize incoming message", err);
          return;
        }
        for (const h of this.subscribers) {
          try {
            h(serialized);
          } catch (err) {
            this.logs?.debug("LSP transport adapter: subscriber threw", err);
          }
        }
      });
    }
    this.subscribers.add(handler);
  }

  unsubscribe(handler: (value: string) => void): void {
    this.subscribers.delete(handler);
    if (this.subscribers.size === 0 && this.releaseOnMessage) {
      this.releaseOnMessage();
      this.releaseOnMessage = null;
    }
  }

  /** Tears down the underlying transport. Called by the LSP manager on dispose. */
  dispose(): void {
    if (this.releaseOnMessage) {
      this.releaseOnMessage();
      this.releaseOnMessage = null;
    }
    this.subscribers.clear();
    this.transport.close();
  }
}

/** Convenience: wrap a minicode transport into a package transport. */
export function adaptTransport(
  transport: LspTransport,
  logs?: LogContext,
  serverRequestHandler?: ServerRequestHandler,
): LspTransportAdapter {
  return new LspTransportAdapter(transport, logs, serverRequestHandler);
}
