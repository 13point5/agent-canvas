import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { type BoardMetadata, createBoardSchema } from "@agent-canvas/shared";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

import { emitBoardEvent } from "@/lib/events";
import { ensureDir, getBoardDir, getBoardsDir, listDirs, readJSON, writeJSON } from "@/lib/storage";

const boards = new Hono();

// List all boards
boards.get("/", async (c) => {
  await ensureDir(getBoardsDir());
  const ids = await listDirs(getBoardsDir());

  const results = await Promise.all(
    ids.map((id) => readJSON<BoardMetadata>(join(getBoardDir(id), "metadata.json"))),
  );
  const allBoards = results.filter((m): m is BoardMetadata => m !== null);

  // Sort by createdAt descending (newest first)
  allBoards.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

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

export { boards };
