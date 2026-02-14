import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { Editor, TLStoreSnapshot } from "tldraw";
import { loadSnapshot, Tldraw } from "tldraw";
import { create } from "zustand";
import { boardsApi } from "@/api/client";
import { HtmlShapeUtil } from "@/tldraw-shapes/html";
import { MarkdownShapeUtil } from "@/tldraw-shapes/markdown";

const customShapeUtils = [MarkdownShapeUtil, HtmlShapeUtil];

const MAX_CACHED_EDITORS = 10;

interface EditorEntry {
  editor: Editor;
  boardId: string;
  loadedAt: number;
  container: HTMLDivElement | null;
  root: Root | null;
}

interface EditorStore {
  editors: Map<string, EditorEntry>;

  registerEditor: (boardId: string, editor: Editor, container: HTMLDivElement, root: Root) => void;
  setVisibleEditor: (boardId: string, editor: Editor) => void;
  unsetVisibleEditor: (boardId: string) => void;
  getEditor: (boardId: string) => Editor | undefined;
  loadBoard: (boardId: string, forceNew?: boolean) => Promise<Editor>;
  cleanupEditor: (boardId: string) => void;
  evictOldest: () => void;
}

export const useEditorStore = create<EditorStore>((set, get) => ({
  editors: new Map(),

  registerEditor: (boardId, editor, container, root) => {
    set((state) => {
      if (state.editors.has(boardId)) return state;

      const newMap = new Map(state.editors);
      newMap.set(boardId, {
        editor,
        boardId,
        loadedAt: Date.now(),
        container,
        root,
      });
      return { editors: newMap };
    });

    if (get().editors.size > MAX_CACHED_EDITORS) {
      get().evictOldest();
    }
  },

  setVisibleEditor: (boardId, editor) => {
    set((state) => {
      const newMap = new Map(state.editors);
      newMap.set(boardId, {
        editor,
        boardId,
        loadedAt: Date.now(),
        container: null,
        root: null,
      });
      return { editors: newMap };
    });
  },

  unsetVisibleEditor: (boardId) => {
    set((state) => {
      const entry = state.editors.get(boardId);
      if (entry && entry.container === null) {
        const newMap = new Map(state.editors);
        newMap.delete(boardId);
        return { editors: newMap };
      }
      return state;
    });
  },

  getEditor: (boardId) => {
    return get().editors.get(boardId)?.editor;
  },

  cleanupEditor: (boardId) => {
    const entry = get().editors.get(boardId);
    if (!entry) return;

    if (entry.root) entry.root.unmount();
    if (entry.container) entry.container.remove();

    set((state) => {
      const newMap = new Map(state.editors);
      newMap.delete(boardId);
      return { editors: newMap };
    });
  },

  evictOldest: () => {
    const entries = Array.from(get().editors.values());
    if (entries.length === 0) return;

    // Only evict offscreen editors (those with container !== null)
    const offscreen = entries.filter((e) => e.container !== null);
    if (offscreen.length === 0) return;

    const oldest = offscreen.reduce((a, b) => (a.loadedAt < b.loadedAt ? a : b));
    get().cleanupEditor(oldest.boardId);
  },

  loadBoard: async (boardId, forceNew) => {
    if (!forceNew) {
      const existing = get().getEditor(boardId);
      if (existing) return existing;
    } else {
      // Evict the cached editor before creating a fresh one
      get().cleanupEditor(boardId);
    }

    const container = document.createElement("div");
    container.style.cssText =
      "position:absolute;left:-9999px;top:-9999px;width:800px;height:600px;";
    document.body.appendChild(container);

    const inner = document.createElement("div");
    inner.style.cssText = "width:100%;height:100%;";
    container.appendChild(inner);

    const root = createRoot(inner);

    return new Promise<Editor>((resolve, reject) => {
      const handleMount = (editor: Editor) => {
        get().registerEditor(boardId, editor, container, root);

        boardsApi
          .getSnapshot(boardId)
          .then(({ snapshot }) => {
            if (snapshot) {
              loadSnapshot(editor.store, snapshot as TLStoreSnapshot);
            }
            resolve(editor);
          })
          .catch((e) => {
            root.unmount();
            container.remove();
            reject(e);
          });
      };

      root.render(
        createElement(Tldraw, {
          onMount: handleMount,
          shapeUtils: customShapeUtils,
        }),
      );
    });
  },
}));
