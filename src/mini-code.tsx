import { FileTree } from "./components/file-tree/file-tree";
import { Tabs } from "./components/tabs/tabs";
import { MiniCodeContext } from "./context";
import { stylesheet } from "./styles";

export type Dirent = {
  isDirectory(): boolean;
  isFile(): boolean;
  isSymbolicLink(): boolean;
  name: string;
};

export interface Filesystem {
  readdir(path: string): Promise<string[]>;
  readdir(path: string, opts: { withFileTypes: true }): Promise<Dirent[]>;
  readFile(path: string, encoding: "utf-8"): Promise<string>;
  writeFile(path: string, data: string): Promise<void>;
  unlink(path: string): Promise<void>;
  mkdir(path: string): Promise<void>;
  watch(
    path: string,
    options?: {
      recursive?: boolean;
      signal?: AbortSignal;
    },
  ): AsyncIterable<{
    eventType: string;
    filename: string;
  }>;
}

export type MiniCodeOptions = {
  root: string;
  filesystem: Filesystem;
};

export function MiniCode(opts: MiniCodeOptions) {
  const ctx = new MiniCodeContext(opts);

  const shadowRootHost = <div class="minicode-shadow-root"></div>;
  const shadowRoot = shadowRootHost.attachShadow({ mode: "closed" });
  shadowRoot.append(
    <div class="minicode-editor">
      <style>{stylesheet}</style>
      <FileTree ctx={ctx} />
      <Tabs ctx={ctx} />
    </div>,
  );

  return shadowRootHost;
}
