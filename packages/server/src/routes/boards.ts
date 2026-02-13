import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { basename, isAbsolute, join } from "node:path";
import {
  type BoardMetadata,
  createBoardSchema,
  createShapesBodySchema,
  deleteShapesBodySchema,
  type Snapshot,
  snapshotSchema,
  updateBoardSchema,
  updateShapesBodySchema,
} from "@agent-canvas/shared";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { imageSizeFromFile } from "image-size/fromFile";

import { emitBoardEvent } from "@/lib/events";
import { createPendingRequest } from "@/lib/pending-requests";
import {
  copyToBoardAssets,
  ensureDir,
  getBoardDir,
  getBoardsDir,
  listDirs,
  readJSON,
  removeDir,
  writeJSON,
} from "@/lib/storage";
import { getClientCount, sendToClients } from "@/lib/ws";

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

// Get board metadata
boards.get("/:id", async (c) => {
  const id = c.req.param("id");
  const metadata = await readJSON<BoardMetadata>(join(getBoardDir(id), "metadata.json"));

  if (!metadata) {
    return c.json({ error: "Board not found" }, 404);
  }

  return c.json(metadata);
});

// Update board
boards.patch("/:id", zValidator("json", updateBoardSchema as any), async (c) => {
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
});

// Delete board
boards.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const boardDir = getBoardDir(id);

  const metadata = await readJSON<BoardMetadata>(join(boardDir, "metadata.json"));

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
  const snapshot = await readJSON<Snapshot>(join(getBoardDir(id), "snapshot.json"));

  return c.json({ snapshot });
});

// Save snapshot
boards.put("/:id/snapshot", zValidator("json", snapshotSchema as any), async (c) => {
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
});

// Get shapes from a board (via WebSocket relay to browser)
boards.get("/:id/shapes", async (c) => {
  const id = c.req.param("id");

  const metadata = await readJSON<BoardMetadata>(join(getBoardDir(id), "metadata.json"));
  if (!metadata) {
    return c.json({ error: "Board not found" }, 404);
  }

  if (getClientCount() === 0) {
    return c.json(
      {
        error: "No browser clients connected. Open the board in a browser first.",
      },
      503,
    );
  }

  const requestId = randomUUID();

  sendToClients({
    type: "get-shapes:request",
    requestId,
    boardId: id,
  });

  try {
    const shapes = await createPendingRequest<unknown[]>(requestId, id);
    return c.json({ boardId: id, shapes });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "TIMEOUT") {
      return c.json({ error: "Request timed out waiting for browser response" }, 504);
    }
    return c.json({ error: message }, 500);
  }
});

// Create shapes on a board (via WebSocket relay to browser)
boards.post("/:id/shapes", zValidator("json", createShapesBodySchema as any), async (c) => {
  const id = c.req.param("id");

  const metadata = await readJSON<BoardMetadata>(join(getBoardDir(id), "metadata.json"));
  if (!metadata) {
    return c.json({ error: "Board not found" }, 404);
  }

  if (getClientCount() === 0) {
    return c.json(
      {
        error: "No browser clients connected. Open the board in a browser first.",
      },
      503,
    );
  }

  const { shapes } = c.req.valid("json");
  const requestId = randomUUID();

  // Process image shapes: copy files to board assets, detect dimensions
  const assetPaths: Record<string, string> = {};
  const processedShapes = [];

  for (const shape of shapes) {
    // Handle markdown shapes with filePath
    if (shape.type === "markdown" && shape.props.filePath && !shape.props.markdown) {
      const filePath = shape.props.filePath;

      if (!isAbsolute(filePath)) {
        return c.json({ error: `filePath must be absolute: ${filePath}` }, 400);
      }
      if (!existsSync(filePath)) {
        return c.json({ error: `File not found: ${filePath}` }, 400);
      }

      const content = await readFile(filePath, "utf-8");
      const name = shape.props.name || basename(filePath).replace(/\.[^.]+$/, "");
      processedShapes.push({
        ...shape,
        props: { ...shape.props, markdown: content, name },
      });
      continue;
    }

    if (shape.type !== "image") {
      processedShapes.push(shape);
      continue;
    }

    const imgShape = shape as {
      type: "image";
      x: number;
      y: number;
      src: string;
      tempId?: string;
      props?: { w?: number; h?: number };
    };

    if (!existsSync(imgShape.src)) {
      return c.json({ error: `Image file not found: ${imgShape.src}` }, 400);
    }

    const { filename, fullPath } = await copyToBoardAssets(imgShape.src, id);

    let w = imgShape.props?.w;
    let h = imgShape.props?.h;
    if (w === undefined || h === undefined) {
      try {
        const dimensions = await imageSizeFromFile(fullPath);
        w = w ?? dimensions.width ?? 400;
        h = h ?? dimensions.height ?? 300;
      } catch {
        w = w ?? 400;
        h = h ?? 300;
      }
    }

    const ext = filename.split(".").pop()?.toLowerCase();
    const mimeMap: Record<string, string> = {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      webp: "image/webp",
      svg: "image/svg+xml",
    };
    const mimeType = (ext && mimeMap[ext]) ?? "image/png";

    const assetUrl = `/api/boards/${id}/assets/${filename}`;
    assetPaths[basename(imgShape.src)] = assetUrl;

    processedShapes.push({
      ...imgShape,
      src: assetUrl,
      props: { ...imgShape.props, w, h },
      name: filename,
      mimeType,
    });
  }

  sendToClients({
    type: "create-shapes:request",
    requestId,
    boardId: id,
    shapes: processedShapes,
  });

  try {
    const result = await createPendingRequest<{
      createdIds: string[];
      idMap?: Record<string, string>;
    }>(requestId, id);
    return c.json({
      boardId: id,
      createdIds: result.createdIds,
      idMap: result.idMap,
      ...(Object.keys(assetPaths).length > 0 ? { assetPaths } : {}),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "TIMEOUT") {
      return c.json({ error: "Request timed out waiting for browser response" }, 504);
    }
    return c.json({ error: message }, 500);
  }
});

// Update shapes on a board (via WebSocket relay to browser)
boards.patch("/:id/shapes", zValidator("json", updateShapesBodySchema as any), async (c) => {
  const id = c.req.param("id");

  const metadata = await readJSON<BoardMetadata>(join(getBoardDir(id), "metadata.json"));
  if (!metadata) {
    return c.json({ error: "Board not found" }, 404);
  }

  if (getClientCount() === 0) {
    return c.json(
      {
        error: "No browser clients connected. Open the board in a browser first.",
      },
      503,
    );
  }

  const { shapes } = c.req.valid("json");
  const requestId = randomUUID();

  sendToClients({
    type: "update-shapes:request",
    requestId,
    boardId: id,
    shapes,
  });

  try {
    const result = await createPendingRequest<{ updatedIds: string[] }>(requestId, id);
    return c.json({ boardId: id, updatedIds: result.updatedIds });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "TIMEOUT") {
      return c.json({ error: "Request timed out waiting for browser response" }, 504);
    }
    return c.json({ error: message }, 500);
  }
});

// Delete shapes on a board (via WebSocket relay to browser)
boards.delete("/:id/shapes", zValidator("json", deleteShapesBodySchema as any), async (c) => {
  const id = c.req.param("id");

  const metadata = await readJSON<BoardMetadata>(join(getBoardDir(id), "metadata.json"));
  if (!metadata) {
    return c.json({ error: "Board not found" }, 404);
  }

  if (getClientCount() === 0) {
    return c.json(
      {
        error: "No browser clients connected. Open the board in a browser first.",
      },
      503,
    );
  }

  const { ids } = c.req.valid("json");
  const requestId = randomUUID();

  sendToClients({
    type: "delete-shapes:request",
    requestId,
    boardId: id,
    ids,
  });

  try {
    const result = await createPendingRequest<{ deletedIds: string[] }>(requestId, id);
    return c.json({ boardId: id, deletedIds: result.deletedIds });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "TIMEOUT") {
      return c.json({ error: "Request timed out waiting for browser response" }, 504);
    }
    return c.json({ error: message }, 500);
  }
});

export { boards };
