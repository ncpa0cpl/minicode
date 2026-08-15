import { sig, type Signal } from "@ncpa0cpl/vanilla-jsx/signals";
import { MiniCodeContext } from "../../context";
import { MenuItem } from "../context-menu/context-menu";
import { File } from "../../files";

type ContextMenuState = {
  items: MenuItem[];
  x: number;
  y: number;
};

type Clipboard = { file: File; cut: boolean };

type PromptState = {
  title: string;
  defaultValue: string;
  resolve: (value: string | null) => void;
};

export function useFileContextMenu(ctx: MiniCodeContext) {
  const contextMenu = sig<ContextMenuState | null>(null);
  const clipboard = sig<Clipboard | null>(null);
  const promptState = sig<PromptState | null>(null);

  const openPrompt = (title: string, defaultValue = ""): Promise<string | null> => {
    return new Promise((resolve) => {
      promptState.dispatch({ title, defaultValue, resolve });
    });
  };

  const closePrompt = (value: string | null) => {
    const state = promptState.get();
    if (state) {
      state.resolve(value);
      promptState.dispatch(null);
    }
  };

  const buildMenuItems = (target: File | null): MenuItem[] => {
    const items: MenuItem[] = [];
    const dirFile = target
      ? target.isDir
        ? target
        : null
      : ctx.root;
    const dirPath = dirFile ? dirFile.path : ctx.root.path;

    items.push({ label: "New File", action: () => newFile(dirPath) });
    items.push({ label: "New Folder", action: () => newFolder(dirPath) });

    if (target) {
      items.push({ separator: true });
      items.push({
        label: "Cut",
        action: () => clipboard.dispatch({ file: target, cut: true }),
      });
      items.push({
        label: "Copy",
        action: () => clipboard.dispatch({ file: target, cut: false }),
      });
    }

    if (clipboard.get()) {
      items.push({ separator: true });
      items.push({
        label: "Paste",
        action: () => {
          const cb = clipboard.get()!;
          if (cb.cut) {
            ctx.movePathTo(cb.file, dirPath);
            clipboard.dispatch(null);
          } else {
            ctx.copyPathTo(cb.file, dirPath);
          }
        },
      });
    }

    if (target) {
      items.push({ separator: true });
      items.push({
        label: "Rename",
        action: async () => {
          const oldName = target.name;
          const newName = await openPrompt("Enter new name:", oldName);
          if (newName && newName !== oldName) {
            ctx.renamePath(target, newName);
          }
        },
      });
      items.push({
        label: "Delete",
        action: () => {
          if (confirm(`Delete "${target.name}"?`)) {
            ctx.deletePath(target);
          }
        },
      });
    }

    if (target && target.isDir) {
      items.push({
        label: "Refresh",
        action: () => {
          ctx.refreshDir(target.path);
        },
      });
    }

    return items;
  };

  const newFile = async (dirPath: string) => {
    const name = await openPrompt("Enter file name:");
    if (name) ctx.createFile(dirPath, name);
  };

  const newFolder = async (dirPath: string) => {
    const name = await openPrompt("Enter folder name:");
    if (name) ctx.createDirectory(dirPath, name);
  };

  const openContextMenu = (e: MouseEvent, target: File | null) => {
    e.preventDefault();
    e.stopPropagation();
    contextMenu.dispatch({
      items: buildMenuItems(target),
      x: e.clientX,
      y: e.clientY,
    });
  };

  return {
    contextMenu,
    promptState,
    closePrompt,
    buildMenuItems,
    newFile,
    newFolder,
    openContextMenu,
  };
}

export type FileContextMenuApi = ReturnType<typeof useFileContextMenu>;
export type PromptStateSignal = Signal<PromptState | null>;
