import { EditorView } from "codemirror";
import { File } from "../../files";
import { Signal } from "@ncpa0cpl/vanilla-jsx/signals";

export type TabData = {
  file: File;
  initialContent: string;
  savedContent: string;
  dirty: Signal<boolean>;
  view?: EditorView;
};
