import { useEffect } from "react";
import { queryClient, queryKeys } from "@/api/queryClient";

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
          if (data.type === "board:created" || data.type === "board:updated" || data.type === "board:deleted") {
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
