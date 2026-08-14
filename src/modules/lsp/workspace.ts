import { type ChangeSet, type Text, type TransactionSpec } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { LSPPlugin, LSPClient, Workspace, type WorkspaceFile } from "@codemirror/lsp-client";

/**
 * Resolves a target URI to a visible editor view, opening/focusing a tab as
 * necessary. Used by {@link MinicodeWorkspace.displayFile} to support
 * cross-file navigation (go-to-definition, find-references). Return null when
 * the file cannot be displayed.
 */
export type DisplayFileFn = (uri: string) => Promise<EditorView | null>;

/** Structural replacement for the non-exported `WorkspaceFileUpdate`. */
export interface WorkspaceFileUpdate {
  file: WorkspaceFile;
  prevDoc: Text;
  changes: ChangeSet;
}

/**
 * A {@link Workspace} implementation tailored to minicode.
 *
 * Differences from the package's `DefaultWorkspace`:
 *  - {@link openFile} is idempotent: re-opening an already-open file reuses the
 *    existing entry instead of throwing (matching minicode's tolerant
 *    document-tracking semantics).
 *  - {@link displayFile} delegates to a host-provided callback so that
 *    cross-file navigation opens/focuses a real editor tab.
 *  - {@link updateFile} dispatches server-driven edits to the file's view,
 *    enabling features like rename/format that touch multiple files.
 */
export class MinicodeWorkspace extends Workspace {
  files: WorkspaceFileEntry[] = [];
  private fileVersions: Record<string, number> = Object.create(null);

  constructor(
    client: LSPClient,
    private readonly displayFileFn: DisplayFileFn,
  ) {
    super(client);
  }

  private nextFileVersion(uri: string): number {
    this.fileVersions[uri] = (this.fileVersions[uri] ?? -1) + 1;
    return this.fileVersions[uri];
  }

  syncFiles(): readonly WorkspaceFileUpdate[] {
    const result: WorkspaceFileUpdate[] = [];
    for (const file of this.files) {
      const plugin = LSPPlugin.get(file.view);
      if (!plugin) continue;
      const changes = plugin.unsyncedChanges;
      if (!changes.empty) {
        result.push({ changes, file, prevDoc: file.doc });
        file.doc = file.view.state.doc;
        file.version = this.nextFileVersion(file.uri);
        plugin.clear();
      }
    }
    return result;
  }

  openFile(uri: string, languageId: string, view: EditorView): void {
    const existing = this.getFile(uri) as WorkspaceFileEntry | null;
    if (existing) {
      // Reuse the existing entry; just refresh the view reference so the
      // latest editor drives synchronization. We do NOT re-send didOpen.
      existing.view = view;
      return;
    }
    const entry = new WorkspaceFileEntry(
      uri,
      languageId,
      this.nextFileVersion(uri),
      view.state.doc,
      view,
    );
    this.files.push(entry);
    this.client.didOpen(entry);
  }

  closeFile(uri: string, _view: EditorView): void {
    const file = this.getFile(uri) as WorkspaceFileEntry | null;
    if (file) {
      this.files = this.files.filter((f) => f !== file);
      this.client.didClose(uri);
    }
  }

  override updateFile(uri: string, update: TransactionSpec): void {
    const file = this.getFile(uri) as WorkspaceFileEntry | null;
    if (file && file.view) file.view.dispatch(update);
  }

  override async displayFile(uri: string): Promise<EditorView | null> {
    const file = this.getFile(uri) as WorkspaceFileEntry | null;
    if (file && file.view) return file.view;
    return this.displayFileFn(uri);
  }
}

/** A tracked open file with its current editor view. */
export class WorkspaceFileEntry implements WorkspaceFile {
  constructor(
    readonly uri: string,
    readonly languageId: string,
    public version: number,
    public doc: Text,
    public view: EditorView,
  ) {}

  getView(): EditorView | null {
    return this.view;
  }
}
