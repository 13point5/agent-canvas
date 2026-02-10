import type {
  CreateShapesRequest,
  CreateShapesResponse,
  GetShapesRequest,
  GetShapesResponse,
} from "@agent-canvas/shared";
import { useEffect } from "react";
import { getSnapshot } from "tldraw";
import { boardsMutations } from "@/api/client";
import { queryClient, queryKeys } from "@/api/queryClient";
import { useEditorStore } from "@/stores/editor-store";

export function useWebSocket() {
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    function connect() {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const url = `${protocol}//${window.location.host}/ws`;

      ws = new WebSocket(url);

      ws.onerror = () => {};

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === "get-shapes:request" && ws) {
            handleGetShapesRequest(ws, data as GetShapesRequest);
            return;
          }

          if (data.type === "create-shapes:request" && ws) {
            handleCreateShapesRequest(ws, data as CreateShapesRequest);
            return;
          }

          if (
            data.type === "board:created" ||
            data.type === "board:updated" ||
            data.type === "board:deleted"
          ) {
            queryClient.invalidateQueries({ queryKey: queryKeys.boards });
          }
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onclose = () => {
        ws = null;
        reconnectTimer = setTimeout(connect, 3000);
      };
    }

    async function handleGetShapesRequest(
      ws: WebSocket,
      request: GetShapesRequest,
    ) {
      const { requestId, boardId } = request;
      try {
        const editor = await useEditorStore.getState().loadBoard(boardId);
        const shapes = editor.getCurrentPageShapesInReadingOrder();

        const response: GetShapesResponse = {
          type: "get-shapes:response",
          requestId,
          shapes,
        };
        ws.send(JSON.stringify(response));
      } catch (e) {
        const response: GetShapesResponse = {
          type: "get-shapes:response",
          requestId,
          shapes: null,
          error: e instanceof Error ? e.message : "Failed to load board",
        };
        ws.send(JSON.stringify(response));
      }
    }

    async function handleCreateShapesRequest(
      ws: WebSocket,
      request: CreateShapesRequest,
    ) {
      const { requestId, boardId, shapes } = request;
      try {
        const editor = await useEditorStore.getState().loadBoard(boardId);

        const beforeIds = new Set(editor.getCurrentPageShapeIds());
        editor.createShapes(
          shapes as Parameters<typeof editor.createShapes>[0],
        );

        const afterIds = editor.getCurrentPageShapeIds();
        const createdIds = [...afterIds].filter((id) => !beforeIds.has(id));

        const snapshot = getSnapshot(editor.store);
        await boardsMutations.saveSnapshot({ id: boardId, snapshot });

        const response: CreateShapesResponse = {
          type: "create-shapes:response",
          requestId,
          createdIds,
        };
        ws.send(JSON.stringify(response));
      } catch (e) {
        const response: CreateShapesResponse = {
          type: "create-shapes:response",
          requestId,
          createdIds: null,
          error: e instanceof Error ? e.message : "Failed to create shapes",
        };
        ws.send(JSON.stringify(response));
      }
    }

    connect();

    return () => {
      clearTimeout(reconnectTimer);

      if (ws) {
        ws.onclose = null;
        ws.close();
      }
    };
  }, []);
}
