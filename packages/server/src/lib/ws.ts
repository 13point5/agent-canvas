import type {
  BoardEvent,
  CreateShapesRequest,
  CreateShapesResponse,
  GetShapesRequest,
  GetShapesResponse,
} from "@agent-canvas/shared";
import type { ServerWebSocket } from "bun";
import { boardEvents } from "./events";
import { resolvePendingRequest } from "./pending-requests";

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

export function sendToClients(message: GetShapesRequest | CreateShapesRequest) {
  const data = JSON.stringify(message);
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
  message(_ws: ServerWebSocket, message: string | Buffer) {
    try {
      const data = JSON.parse(
        typeof message === "string" ? message : message.toString(),
      ) as GetShapesResponse | CreateShapesResponse;

      if (data.type === "get-shapes:response") {
        resolvePendingRequest(data.requestId, data.shapes, data.error);
      } else if (data.type === "create-shapes:response") {
        resolvePendingRequest(data.requestId, data.createdIds, data.error);
      }
    } catch {
      // Ignore malformed messages
    }
  },
};
