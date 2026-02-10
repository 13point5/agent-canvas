import { useEffect } from "react";

export function useWebSocket() {
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    function connect() {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const url = `${protocol}//${window.location.host}/ws`;

      ws = new WebSocket(url);

      ws.onerror = () => {};

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
