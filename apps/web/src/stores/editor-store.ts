import type { Editor } from "tldraw";
import { create } from "zustand";

/**
 * Simple store to track the currently visible tldraw editor per board.
 * With tldraw sync, there's no need for headless editors or snapshot loading —
 * the sync server is the source of truth.
 */
interface EditorStore {
  editors: Map<string, Editor>;

  setVisibleEditor: (boardId: string, editor: Editor) => void;
  unsetVisibleEditor: (boardId: string) => void;
  getEditor: (boardId: string) => Editor | undefined;
}

export const useEditorStore = create<EditorStore>((set, get) => ({
  editors: new Map(),

  setVisibleEditor: (boardId, editor) => {
    set((state) => {
      const newMap = new Map(state.editors);
      newMap.set(boardId, editor);
      return { editors: newMap };
    });
  },

  unsetVisibleEditor: (boardId) => {
    set((state) => {
      const newMap = new Map(state.editors);
      newMap.delete(boardId);
      return { editors: newMap };
    });
  },

  getEditor: (boardId) => {
    return get().editors.get(boardId);
  },
}));
