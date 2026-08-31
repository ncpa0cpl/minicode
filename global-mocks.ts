// Stub DOMParser and HTMLElement for environments without a DOM (e.g., Bun test runner)
// This satisfies vanilla-jsx's optional DOM usage.
globalThis.DOMParser = class {
  parseFromString() {
    return {};
  }
} as any;
globalThis.HTMLElement = class {} as any;
