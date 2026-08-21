import { EditorView } from "codemirror";
import { MiniCodeContext } from "../../context";
import { MiniCodeOptions } from "../../mini-code";
import { LspManager } from "./manager";
import { toUri } from "./types";
import { createLspExtensions } from "./extensions";
import { File } from "../../files";
import { CmEditor } from "../../utils/cm-ext";

export class LspContext {
  private lspManager: LspManager;

  constructor(
    private readonly minicode: MiniCodeContext,
    opts: MiniCodeOptions,
  ) {
    this.lspManager = new LspManager(
      opts.lsp ?? [],
      toUri(opts.root),
      (uri) => this.displayFile(uri),
      minicode.logs,
    );
  }

  registerPlugins(cm: CmEditor, file: File) {
    const lspPlugin = cm.addPlugin("lsp");
    lspPlugin.replace(
      ...createLspExtensions(this.lspManager, file, () => this.minicode.themes.getSyntaxStyle()),
    );
  }

  updatePlugins(cm: CmEditor, file: File) {
    const lspPlugin = cm.getOrAddPlugin("lsp");
    lspPlugin.replace(
      ...createLspExtensions(this.lspManager, file, () => this.minicode.themes.getSyntaxStyle()),
    );
  }

  /**
   * Opens (or focuses) the tab for the given `file://` URI and resolves with
   * its editor view. Used by the LSP workspace to support cross-file
   * navigation such as go-to-definition and find-references.
   */
  private async displayFile(uri: string): Promise<EditorView | null> {
    const path = uriToPath(uri);
    if (path === null) return null;

    const file = await this.minicode.findFile(path);
    if (!file) {
      this.minicode.logs.warn("LSP attempted to open an unknown file:", path);
      return null;
    }

    const tab = await this.minicode.tabs.open(file);
    if (!tab) return null;

    this.minicode.expandAll(tab.file.path).catch((err) => {
      this.minicode.logs.error("File Tree expandAll command failed", err);
    });

    // The editor view is assigned in the tab's render callback, which runs
    // asynchronously after the tab data is dispatched. Poll until it's set.
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      if (tab.view) return tab.view;
      await new Promise((r) => setTimeout(r, 30));
    }
    return tab.view ?? null;
  }

  /** Forward a filesystem change event to the LSP manager. */
  onFileChange(relPath: string, eventType: string): void {
    this.lspManager.onFileChange(relPath, eventType);
  }

  terminate() {
    this.lspManager.dispose();
  }
}

function uriToPath(uri: string): string | null {
  if (!uri.startsWith("file://")) return null;
  return uri.slice("file://".length);
}
