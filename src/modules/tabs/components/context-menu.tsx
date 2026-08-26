import { sig } from "@ncpa0cpl/vanilla-jsx/signals";
import { MiniCodeContext } from "../../../context";
import { MenuItem } from "../../../components/context-menu/context-menu";
import { TabData } from "../types";

type ContextMenuState = {
  items: MenuItem[];
  x: number;
  y: number;
};

export function useTabsContextMenu(ctx: MiniCodeContext) {
  const contextMenu = sig<ContextMenuState | null>(null);

  const buildMenuItems = (tab: TabData): MenuItem[] => {
    const items: MenuItem[] = [];

    if (ctx.formatter.canFormat(tab.file)) {
      items.push({
        label: "Format",
        action: () => {
          ctx.tabs.formatContent(tab.file);
        },
      });
    }
    items.push({
      label: "Close",
      action: () => {
        ctx.tabs.close(tab.file);
      },
    });
    items.push({
      label: "Close All",
      action: () => {
        ctx.tabs.closeAll();
      },
    });
    items.push({
      label: "Close Others",
      action: () => {
        ctx.tabs.closeOthers(tab.file);
      },
    });
    items.push({
      label: "Close Saved",
      action: () => {
        ctx.tabs.closeClean();
      },
    });
    items.push({
      label: "Save & Close",
      action: async () => {
        await ctx.tabs.save(tab.file);
        ctx.tabs.close(tab.file);
      },
    });
    items.push({
      label: "Save & Close All",
      action: () => {
        ctx.tabs.saveAndCloseAll();
      },
    });
    items.push({
      label: "Reveal in sidebar",
      action: () => {
        ctx.revealInSidebar(tab.file.path);
      },
    });

    return items;
  };

  const openContextMenu = (e: MouseEvent, tab: TabData) => {
    e.preventDefault();
    e.stopPropagation();
    contextMenu.dispatch({
      items: buildMenuItems(tab),
      x: e.clientX,
      y: e.clientY,
    });
  };

  return {
    contextMenu,
    buildMenuItems,
    openContextMenu,
  };
}
