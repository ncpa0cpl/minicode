// DOM preload for the harness (happy-dom)
import { Window } from "/tmp/opencode/node_modules/happy-dom/lib/index.js";

const win = new Window({ url: "http://localhost/" });

const globals = {
  window: win,
  document: win.document,
  navigator: win.navigator,
  HTMLElement: win.HTMLElement,
  HTMLDivElement: win.HTMLDivElement,
  HTMLSpanElement: win.HTMLSpanElement,
  HTMLButtonElement: win.HTMLButtonElement,
  HTMLInputElement: win.HTMLInputElement,
  HTMLTextAreaElement: win.HTMLTextAreaElement,
  SVGElement: win.SVGElement,
  Element: win.Element,
  Node: win.Node,
  Text: win.Text,
  DocumentFragment: win.DocumentFragment,
  Document: win.Document,
  ShadowRoot: win.ShadowRoot,
  CustomElementRegistry: win.CustomElementRegistry,
  customElements: win.customElements,
  CustomEvent: win.CustomEvent,
  Event: win.Event,
  EventTarget: win.EventTarget,
  KeyboardEvent: win.KeyboardEvent,
  MouseEvent: win.MouseEvent,
  ClipboardEvent: win.ClipboardEvent,
  DataTransfer: win.DataTransfer,
  DOMParser: win.DOMParser,
  MutationObserver: win.MutationObserver,
  ResizeObserver: win.ResizeObserver,
  getComputedStyle: win.getComputedStyle.bind(win),
  requestAnimationFrame: win.requestAnimationFrame?.bind(win) ?? ((cb: any) => setTimeout(cb, 0)),
  cancelAnimationFrame: win.cancelAnimationFrame?.bind(win) ?? clearTimeout,
  localStorage: win.localStorage,
  location: win.location,
  history: win.history,
  selection: win.getSelection?.bind(win),
  getSelection: win.getSelection?.bind(win),
};

for (const [k, v] of Object.entries(globals)) {
  if (v !== undefined) (globalThis as any)[k] = v;
}
(globalThis as any).Window = Window;
