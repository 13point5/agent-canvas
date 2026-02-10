import type { ServerWebSocket } from "bun";
import type { BoardEvent } from "@agent-canvas/shared";
import { boardEvents } from "./events";

const clients = new Set<ServerWebSocket>();

export function addClient(ws: ServerWebSocket) {
  clients.add(ws);
}

export function removeClient(ws: ServerWebSocket) {
  clients.delete(ws);
}

export function getClientCount(): number {
  return clients.size;
}

function broadcast(event: BoardEvent) {
  const data = JSON.stringify(event);
  for (const ws of clients) {
    ws.send(data);
  }
}

// Forward board events to all connected WebSocket clients
boardEvents.on("board-event", broadcast);

export const websocketHandler = {
  open(ws: ServerWebSocket) {
    addClient(ws);
  },
  close(ws: ServerWebSocket) {
    removeClient(ws);
  },
  message() {
    // No inbound message handling needed
  },
};
