import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import {
  type BoardMetadata,
  type CreateShapesBody,
  createBoardSchema,
  createShapesBodySchema,
  deleteShapesBodySchema,
  type InputShape,
  type ScreenshotShapesBody,
  type Snapshot,
  screenshotShapesBodySchema,
  snapshotSchema,
  type UpdateShape,
  type UpdateShapesBody,
  updateBoardSchema,
  updateShapesBodySchema,
} from "@agent-canvas/shared";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { imageSizeFromFile } from "image-size/fromFile";

import { emitBoardEvent } from "@/lib/events";
import { createPendingRequest } from "@/lib/pending-requests";
import { isFileBackedInputShape, isFileBackedUpdateShape, resolveShapeContentFromFile } from "@/lib/shape-content";
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

  const results = await Promise.all(ids.map((id) => readJSON<BoardMetadata>(join(getBoardDir(id), "metadata.json"))));
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

// Create a screenshot of specific shapes on a board (via WebSocket relay to browser)
boards.post("/:id/screenshot", zValidator("json", screenshotShapesBodySchema as any), async (c) => {
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

  const { ids } = c.req.valid("json") as ScreenshotShapesBody;
  const requestId = randomUUID();

  sendToClients({
    type: "screenshot-shapes:request",
    requestId,
    boardId: id,
    ids,
  });

  try {
    const result = await createPendingRequest<{
      imageDataUrl: string;
      width?: number;
      height?: number;
    }>(requestId, id);

    if (!result.imageDataUrl) {
      return c.json({ error: "Browser returned an empty screenshot payload" }, 500);
    }

    if (typeof result.width !== "number" || typeof result.height !== "number") {
      return c.json({ error: "Browser did not return screenshot dimensions" }, 500);
    }

    const { bytes, extension } = decodeScreenshotDataUrl(result.imageDataUrl);
    const filePath = join(tmpdir(), `agent-canvas-screenshot-${id}-${randomUUID()}.${extension}`);

    await writeFile(filePath, bytes);

    return c.json({
      boardId: id,
      filePath,
      width: result.width,
      height: result.height,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "TIMEOUT") {
      return c.json({ error: "Request timed out waiting for browser response" }, 504);
    }
    return c.json({ error: message }, 500);
  }
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

  const { shapes } = c.req.valid("json") as CreateShapesBody;
  const requestId = randomUUID();

  // Process image shapes: copy files to board assets, detect dimensions
  const assetPaths: Record<string, string> = {};
  const processedShapes = [];

  for (const shape of shapes) {
    let resolvedShape: InputShape;

    try {
      resolvedShape = isFileBackedInputShape(shape) ? await resolveShapeContentFromFile(shape) : shape;
    } catch (error) {
      return c.json(
        {
          error: error instanceof Error ? error.message : "Failed to resolve file-backed shape",
        },
        400,
      );
    }

    if (resolvedShape.type !== "image") {
      processedShapes.push(resolvedShape);
      continue;
    }

    const imgShape = resolvedShape as {
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

  const { shapes } = c.req.valid("json") as UpdateShapesBody;
  const requestId = randomUUID();

  const processedShapes = [];
  for (const shape of shapes) {
    let resolvedShape: UpdateShape;

    try {
      resolvedShape = isFileBackedUpdateShape(shape)
        ? await resolveShapeContentFromFile(shape, { defaultMissingContent: false })
        : shape;
    } catch (error) {
      return c.json(
        {
          error: error instanceof Error ? error.message : "Failed to resolve file-backed shape",
        },
        400,
      );
    }

    processedShapes.push(resolvedShape);
  }

  sendToClients({
    type: "update-shapes:request",
    requestId,
    boardId: id,
    shapes: processedShapes,
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

function decodeScreenshotDataUrl(dataUrl: string): { bytes: Buffer; extension: "png" | "jpg" | "webp" | "svg" } {
  const match = /^data:(image\/(?:png|jpeg|webp|svg\+xml));base64,(.+)$/.exec(dataUrl);
  if (!match) {
    throw new Error("Browser returned an invalid screenshot payload");
  }

  const mimeType = match[1];
  const base64 = match[2];
  const bytes = Buffer.from(base64, "base64");

  const extensionByMimeType: Record<string, "png" | "jpg" | "webp" | "svg"> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/svg+xml": "svg",
  };

  const extension = extensionByMimeType[mimeType];
  if (!extension) {
    throw new Error(`Unsupported screenshot mime type: ${mimeType}`);
  }

  return { bytes, extension };
}

export { boards };
