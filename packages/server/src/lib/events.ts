import { EventEmitter } from "node:events";
import type { BoardEvent } from "@agent-canvas/shared";

// Global event emitter for broadcasting board changes
export const boardEvents = new EventEmitter();

export function emitBoardEvent(event: BoardEvent): void {
  boardEvents.emit("board-event", event);
}
