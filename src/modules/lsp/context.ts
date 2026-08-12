import { Compartment } from "@codemirror/state";
import { MiniCodeContext } from "../../context";
import { MiniCodeOptions } from "../../mini-code";
import { LspManager } from "./manager";
import { toUri } from "./types";
import { createLspExtensions } from "./extensions";
import { File } from "../../files";

export class LspContext {
  private lspCompartment = new Compartment();
  private lspManager: LspManager;

  constructor(
    private readonly minicode: MiniCodeContext,
    opts: MiniCodeOptions,
  ) {
    this.lspManager = new LspManager(opts.lsp ?? {}, toUri(opts.root), minicode.logs);
  }

  getLspExtensions(file: File) {
    return createLspExtensions(this.lspManager, file);
  }

  cmReconfigure(file: File) {
    return this.lspCompartment.reconfigure(this.getLspExtensions(file));
  }

  cmExtensions(file: File) {
    return [this.lspCompartment.of(this.getLspExtensions(file))];
  }
}
