import type { LspMessage, LspServerRequest, LspTransport } from "./types";

export class LspClient {
  private nextId = 0;
  private pending = new Map<
    number | string,
    { resolve: (v: unknown) => void; reject: (e: unknown) => void }
  >();
  private notificationHandlers = new Map<string, Set<(params: unknown) => void>>();
  private serverRequestHandlers = new Map<
    string,
    (params: unknown) => unknown | Promise<unknown>
  >();
  private disposeTransport: (() => void) | null = null;
  private disposed = false;

  constructor(private transport: LspTransport) {
    this.disposeTransport = transport.onMessage((msg) => this.handleMessage(msg));
  }

  private handleMessage(msg: LspMessage) {
    if ("id" in msg && ("result" in msg || "error" in msg)) {
      // Response to our request
      const pending = this.pending.get(msg.id);
      if (pending) {
        this.pending.delete(msg.id);
        if (msg.error) {
          pending.reject(msg.error);
        } else {
          pending.resolve(msg.result);
        }
      }
    } else if ("id" in msg && "method" in msg) {
      // Server-initiated request — must send a response
      void this.handleServerRequest(msg as unknown as LspServerRequest);
    } else if ("method" in msg && !("id" in msg)) {
      // Notification
      const handlers = this.notificationHandlers.get(msg.method);
      if (handlers) {
        for (const h of handlers) h(msg.params);
      }
    }
  }

  private async handleServerRequest(req: LspServerRequest) {
    const handler = this.serverRequestHandlers.get(req.method);
    try {
      const result = handler ? await handler(req.params) : null;
      this.transport.send({
        jsonrpc: "2.0",
        id: req.id,
        result,
      } as unknown as LspMessage);
    } catch (err) {
      this.transport.send({
        jsonrpc: "2.0",
        id: req.id,
        error: { code: -32603, message: String(err) },
      } as unknown as LspMessage);
    }
  }

  request<R = unknown>(method: string, params?: unknown): Promise<R> {
    const id = this.nextId++;
    return new Promise<R>((resolve, reject) => {
      this.pending.set(id, {
        resolve: resolve as (v: unknown) => void,
        reject: reject as (e: unknown) => void,
      });
      this.transport.send({ jsonrpc: "2.0", id, method, params });
    });
  }

  notify(method: string, params?: unknown): void {
    this.transport.send({ jsonrpc: "2.0", method, params });
  }

  onNotification(method: string, handler: (params: unknown) => void): () => void {
    let set = this.notificationHandlers.get(method);
    if (!set) {
      set = new Set();
      this.notificationHandlers.set(method, set);
    }
    set.add(handler);
    return () => {
      set!.delete(handler);
    };
  }

  onServerRequest(
    method: string,
    handler: (params: unknown) => unknown | Promise<unknown>,
  ): () => void {
    this.serverRequestHandlers.set(method, handler);
    return () => {
      this.serverRequestHandlers.delete(method);
    };
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.disposeTransport?.();
    this.transport.close();
    for (const [, { reject }] of this.pending) {
      reject(new Error("LSP client disposed"));
    }
    this.pending.clear();
  }

  get isDisposed() {
    return this.disposed;
  }
}
