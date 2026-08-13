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
    this.lspManager = new LspManager(minicode.languageConfigs, toUri(opts.root), minicode.logs);
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
}
