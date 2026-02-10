import { useMutation } from "@tanstack/react-query";
import { useCallback, useRef } from "react";
import type { Editor, TLStoreSnapshot } from "tldraw";
import { getSnapshot, loadSnapshot } from "tldraw";
import { boardsApi, boardsMutations } from "@/api/client";

export function useBoardPersistence(boardId: string) {
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveSnapshotMutation = useMutation({
    mutationFn: boardsMutations.saveSnapshot,
  });

  const handleMount = useCallback(
    (editor: Editor) => {
      // Load existing snapshot
      boardsApi.getSnapshot(boardId).then(({ snapshot }) => {
        if (snapshot) {
          loadSnapshot(editor.store, snapshot as TLStoreSnapshot);
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
