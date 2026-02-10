import { join } from "node:path";
import type { BoardMetadata } from "@agent-canvas/shared";
import { Hono } from "hono";

import {
  ensureDir,
  getBoardDir,
  getBoardsDir,
  listDirs,
  readJSON,
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

export { boards };
