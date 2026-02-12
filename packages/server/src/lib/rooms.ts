import {
  NodeSqliteWrapper,
  SQLiteSyncStorage,
  TLSocketRoom,
} from "@tldraw/sync-core";
import { T } from "@tldraw/editor";
import {
  createTLSchema,
  defaultBindingSchemas,
  defaultShapeSchemas,
} from "@tldraw/tlschema";
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { getDataDir } from "./storage";

// Markdown shape props — must match the client's MarkdownShapeUtil
const markdownShapeProps = {
  w: T.number,
  h: T.number,
  name: T.string,
  markdown: T.string,
};

// Schema includes all default shapes + our custom markdown shape
const schema = createTLSchema({
  shapes: {
    ...defaultShapeSchemas,
    markdown: { props: markdownShapeProps },
  },
  bindings: { ...defaultBindingSchemas },
});

function getRoomsDir(): string {
  return join(getDataDir(), "rooms");
}

// Sanitize boardId to prevent path traversal
function sanitizeBoardId(boardId: string): string {
  return boardId.replace(/[^a-zA-Z0-9_-]/g, "_");
}

// Use 'any' for TLSocketRoom generics to avoid deep type conflicts
// between @tldraw/sync-core's UnknownRecord and @tldraw/tlschema's TLRecord
type AnyRoom = TLSocketRoom<any, void>;

// In-memory map of active rooms
const rooms = new Map<string, { room: AnyRoom; db: Database.Database }>();

// Grace period timers for delayed room closure
const closeTimers = new Map<string, ReturnType<typeof setTimeout>>();

const CLOSE_GRACE_MS = 30_000; // 30s after last client disconnects

export function makeOrLoadRoom(boardId: string): AnyRoom {
  boardId = sanitizeBoardId(boardId);

  // Cancel any pending close timer
  const pendingClose = closeTimers.get(boardId);
  if (pendingClose) {
    clearTimeout(pendingClose);
    closeTimers.delete(boardId);
  }

  const existing = rooms.get(boardId);
  if (existing && !existing.room.isClosed()) {
    return existing.room;
  }

  console.log(`[sync] Loading room: ${boardId}`);

  const roomsDir = getRoomsDir();
  mkdirSync(roomsDir, { recursive: true });

  const db = new Database(join(roomsDir, `${boardId}.db`));
  const sql = new NodeSqliteWrapper(db);
  const storage = new SQLiteSyncStorage({ sql });

  const room: AnyRoom = new TLSocketRoom({
    schema,
    storage,
    onSessionRemoved(room, args) {
      console.log(
        `[sync] Client disconnected: ${args.sessionId} from room ${boardId} (${args.numSessionsRemaining} remaining)`,
      );
      if (args.numSessionsRemaining === 0) {
        // Start grace period before closing room
        const timer = setTimeout(() => {
          console.log(
            `[sync] Closing room: ${boardId} (grace period expired)`,
          );
          room.close();
          db.close();
          rooms.delete(boardId);
          closeTimers.delete(boardId);
        }, CLOSE_GRACE_MS);
        closeTimers.set(boardId, timer);
      }
    },
  });

  rooms.set(boardId, { room, db });
  return room;
}

export function getRoom(boardId: string): AnyRoom | undefined {
  boardId = sanitizeBoardId(boardId);
  const entry = rooms.get(boardId);
  if (entry && !entry.room.isClosed()) {
    return entry.room;
  }
  return undefined;
}

export function closeAllRooms(): void {
  for (const [boardId, { room, db }] of rooms) {
    console.log(`[sync] Closing room: ${boardId}`);
    room.close();
    db.close();
  }
  rooms.clear();
  for (const timer of closeTimers.values()) {
    clearTimeout(timer);
  }
  closeTimers.clear();
}
