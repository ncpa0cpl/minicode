import { EditorView } from "@codemirror/view";
import { MiniCodeContext } from "../../context";
import { File } from "../../files";
import { MiniCodeOptions } from "../../mini-code";
import type { Formatter } from "./types";

export class FormatterContext {
  constructor(
    private minicode: MiniCodeContext,
    private opts: MiniCodeOptions,
  ) {}

  private initializedFormatters = new Map<string, Formatter>();

  getFormatter(file: File) {
    if (!file.ext) return;

    const existing = this.initializedFormatters.get(file.ext);
    if (existing) return existing;

    const config = this.minicode.languageConfigs[file.ext];
    if (!config?.fromatter) return;

    try {
      const fmt = config.fromatter();
      if (fmt instanceof Promise) {
        return fmt
          .then((fmt) => {
            this.initializedFormatters.set(file.ext!, fmt);
            return fmt;
          })
          .catch((err) => {
            this.minicode.logs.error("Formatter initialization returned an error", err);
          });
      } else {
        this.initializedFormatters.set(file.ext!, fmt);
        return fmt;
      }
    } catch (err) {
      this.minicode.logs.error("Formatter initialization returned an error", err);
    }
  }

  formatsOnSave(file: File) {
    if (!file.ext) return false;

    const config = this.minicode.languageConfigs[file.ext];
    if (!config || !config.fromatter) return false;

    return config.formatOnSave;
  }

  canFormat(file: File) {
    if (!file.ext) return false;

    const config = this.minicode.languageConfigs[file.ext];
    if (!config || !config.fromatter) return false;

    return true;
  }

  async format(editor: EditorView, file: File, content: string) {
    const fmt = await this.getFormatter(file);
    if (!fmt) return content;
    this.minicode.logs.debug(`Formatting "${file.path}"`);
    const fmtContent = await fmt({ code: content, filepath: file.path });
    this.minicode.tabs.replaceEditorText(editor, fmtContent);
    return fmtContent;
  }
}
