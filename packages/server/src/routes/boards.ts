import { randomUUID } from "node:crypto";
import { join } from "node:path";
import {
  type BoardMetadata,
  createBoardSchema,
  type Snapshot,
  snapshotSchema,
  updateBoardSchema,
} from "@agent-canvas/shared";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

import { emitBoardEvent } from "@/lib/events";
import {
  ensureDir,
  getBoardDir,
  getBoardsDir,
  listDirs,
  readJSON,
  removeDir,
  writeJSON,
} from "@/lib/storage";

const boards = new Hono();

// List all boards
boards.get("/", async (c) => {
  await ensureDir(getBoardsDir());
  const ids = await listDirs(getBoardsDir());

  const results = await Promise.all(
    ids.map((id) =>
      readJSON<BoardMetadata>(join(getBoardDir(id), "metadata.json")),
    ),
  );
  const allBoards = results.filter((m): m is BoardMetadata => m !== null);

  // Sort by createdAt descending (newest first)
  allBoards.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return c.json(allBoards);
});

// Create board
boards.post("/", zValidator("json", createBoardSchema as any), async (c) => {
  const { name } = c.req.valid("json");
  const id = randomUUID();
  const now = new Date().toISOString();

  const metadata: BoardMetadata = {
    id,
    name,
    createdAt: now,
    updatedAt: now,
  };

  await writeJSON(join(getBoardDir(id), "metadata.json"), metadata);

  emitBoardEvent({ type: "board:created", board: metadata });

  return c.json(metadata, 201);
});

// Get board metadata
boards.get("/:id", async (c) => {
  const id = c.req.param("id");
  const metadata = await readJSON<BoardMetadata>(
    join(getBoardDir(id), "metadata.json"),
  );

  if (!metadata) {
    return c.json({ error: "Board not found" }, 404);
  }

  return c.json(metadata);
});

// Update board
boards.patch(
  "/:id",
  zValidator("json", updateBoardSchema as any),
  async (c) => {
    const id = c.req.param("id");
    const updates = c.req.valid("json");

    const metadataPath = join(getBoardDir(id), "metadata.json");
    const metadata = await readJSON<BoardMetadata>(metadataPath);

    if (!metadata) {
      return c.json({ error: "Board not found" }, 404);
    }

    const updated: BoardMetadata = {
      ...metadata,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await writeJSON(metadataPath, updated);

    emitBoardEvent({ type: "board:updated", board: updated });

    return c.json(updated);
  },
);

// Delete board
boards.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const boardDir = getBoardDir(id);

  const metadata = await readJSON<BoardMetadata>(
    join(boardDir, "metadata.json"),
  );

  if (!metadata) {
    return c.json({ error: "Board not found" }, 404);
  }

  await removeDir(boardDir);

  emitBoardEvent({ type: "board:deleted", boardId: id });

  return c.json({ success: true });
});

// Get snapshot
boards.get("/:id/snapshot", async (c) => {
  const id = c.req.param("id");
  const snapshot = await readJSON<Snapshot>(
    join(getBoardDir(id), "snapshot.json"),
  );

  return c.json({ snapshot });
});

// Save snapshot
boards.put(
  "/:id/snapshot",
  zValidator("json", snapshotSchema as any),
  async (c) => {
    const id = c.req.param("id");
    const snapshot = c.req.valid("json");

    const boardDir = getBoardDir(id);
    const metadataPath = join(boardDir, "metadata.json");
    const metadata = await readJSON<BoardMetadata>(metadataPath);

    if (!metadata) {
      return c.json({ error: "Board not found" }, 404);
    }

    await writeJSON(join(boardDir, "snapshot.json"), snapshot);

    metadata.updatedAt = new Date().toISOString();
    await writeJSON(metadataPath, metadata);

    return c.json({ success: true });
  },
);

export { boards };
