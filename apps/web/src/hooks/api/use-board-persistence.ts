import { useMutation } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";
import type { Editor, TLStoreSnapshot } from "tldraw";
import { getSnapshot } from "tldraw";
import { boardsApi, boardsMutations } from "@/api/client";
import { loadSnapshotSafely } from "@/lib/load-snapshot-safely";
import { useEditorStore } from "@/stores/editor-store";

export function useBoardPersistence(boardId: string) {
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorRef = useRef<Editor | null>(null);

  const saveSnapshotMutation = useMutation({
    mutationFn: boardsMutations.saveSnapshot,
  });

  // Register/unregister the visible editor with the store
  useEffect(() => {
    return () => {
      if (editorRef.current) {
        useEditorStore.getState().unsetVisibleEditor(boardId);
      }
    };
  }, [boardId]);

  const handleMount = useCallback(
    (editor: Editor) => {
      editorRef.current = editor;
      useEditorStore.getState().setVisibleEditor(boardId, editor);

      // Load existing snapshot
      boardsApi.getSnapshot(boardId).then(({ snapshot }) => {
        if (snapshot) {
          loadSnapshotSafely(editor, snapshot as TLStoreSnapshot, `board ${boardId}`);
        }
      });

      // Auto-save on changes (debounced 1s)
      const unsubscribe = editor.store.listen(
        () => {
          if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
          }
          saveTimeoutRef.current = setTimeout(() => {
            const snapshot = getSnapshot(editor.store);
            saveSnapshotMutation.mutate({ id: boardId, snapshot });
          }, 1000);
        },
        { source: "user", scope: "document" },
      );

      return () => {
        unsubscribe();
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }
      };
    },
    [boardId, saveSnapshotMutation],
  );

  return { handleMount };
}
