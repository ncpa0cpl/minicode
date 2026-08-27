import { EditorView } from "codemirror";
import { File } from "../../files";
import { Signal } from "@ncpa0cpl/vanilla-jsx/signals";
import { CmEditor } from "../../utils/cm-ext";
import { Diagnostic } from "../../utils/extensions/minicode-lint-diagnostics";

export type TabData = {
  file: File;
  initialContent: string;
  savedContent: string;
  dirty: Signal<boolean>;
  cme: CmEditor;
  view: EditorView;
  diagnostics: Signal<readonly Diagnostic[]>;
  dispose(): void;
};
