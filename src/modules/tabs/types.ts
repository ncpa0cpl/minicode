import { EditorView } from "codemirror";
import { File } from "../../files";
import { Signal } from "@ncpa0cpl/vanilla-jsx/signals";
import { CmEditor } from "../../utils/cm-ext";
import { Diagnostic } from "../../utils/extensions/minicode-lint-diagnostics";

export type TabData = {
  initialContent: string;
  savedContent: string;
  readonly file: File;
  readonly dirty: Signal<boolean>;
  readonly diagnostics: Signal<readonly Diagnostic[]>;
  cme: CmEditor;
  view: EditorView;
  dispose(): void;
};
