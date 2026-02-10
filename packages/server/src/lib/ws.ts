import type { ServerWebSocket } from "bun";

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

export const websocketHandler = {
  open(ws: ServerWebSocket) {
    addClient(ws);
  },
  close(ws: ServerWebSocket) {
    removeClient(ws);
  },
  message() {
    // No message handling needed — connection tracking only
  },
};
