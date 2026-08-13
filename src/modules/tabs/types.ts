import { EditorView } from "codemirror";
import { File } from "../../files";
import { Signal } from "@ncpa0cpl/vanilla-jsx/signals";
import { CmEditor } from "../../utils/cm-ext";

export type TabData = {
  file: File;
  initialContent: string;
  savedContent: string;
  dirty: Signal<boolean>;
  cme?: CmEditor;
  view?: EditorView;
};
