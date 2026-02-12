import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { basename, join } from "node:path";
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
import { type IndexKey, ZERO_INDEX_KEY, getIndexAbove } from "@tldraw/editor";
import { createShapeId } from "@tldraw/tlschema";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { imageSizeFromFile } from "image-size/fromFile";

import { emitBoardEvent } from "@/lib/events";
import { makeOrLoadRoom } from "@/lib/rooms";
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

const boards = new Hono();

// ── Board CRUD ──────────────────────────────────────────────────────

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
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
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

// ── Snapshot endpoints (kept for backwards compat) ──────────────────

// Get snapshot — reads from sync room if active, falls back to file
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

// ── Shape operations (via sync room — no browser relay needed) ──────

// Helper: extract document states from a room snapshot
function getSnapshotDocs(
  room: ReturnType<typeof makeOrLoadRoom>,
): Array<Record<string, unknown>> {
  const snapshot = room.getCurrentSnapshot() as any;
  if (!snapshot?.documents) return [];
  return (snapshot.documents as Array<{ state: any }>).map((d) => d.state);
}

// Helper: find the current page ID from the room's records
function findPageId(room: ReturnType<typeof makeOrLoadRoom>): string {
  for (const state of getSnapshotDocs(room)) {
    if (state.typeName === "page") {
      return state.id as string;
    }
  }
  return "page:page";
}

// Helper: find the highest shape index in the room
function findHighestIndex(room: ReturnType<typeof makeOrLoadRoom>): IndexKey {
  let maxIndex: IndexKey = ZERO_INDEX_KEY;
  for (const state of getSnapshotDocs(room)) {
    if (state.typeName === "shape" && typeof state.index === "string") {
      if (state.index > maxIndex) {
        maxIndex = state.index as IndexKey;
      }
    }
  }
  return maxIndex;
}

// Get shapes from a board
boards.get("/:id/shapes", async (c) => {
  const id = c.req.param("id");

  const metadata = await readJSON<BoardMetadata>(
    join(getBoardDir(id), "metadata.json"),
  );
  if (!metadata) {
    return c.json({ error: "Board not found" }, 404);
  }

  const room = makeOrLoadRoom(id);

  // Extract shapes from the room snapshot
  const shapes: unknown[] = [];
  for (const state of getSnapshotDocs(room)) {
    if (state.typeName === "shape") {
      shapes.push(state);
    }
  }

  return c.json({ boardId: id, shapes });
});

// Create shapes on a board (via sync room)
boards.post(
  "/:id/shapes",
  zValidator("json", createShapesBodySchema as any),
  async (c) => {
    const id = c.req.param("id");

    const metadata = await readJSON<BoardMetadata>(
      join(getBoardDir(id), "metadata.json"),
    );
    if (!metadata) {
      return c.json({ error: "Board not found" }, 404);
    }

    const { shapes } = c.req.valid("json");
    const room = makeOrLoadRoom(id);
    const pageId = findPageId(room);
    let currentIndex = findHighestIndex(room);

    // Build temp→real ID mapping
    const idMap: Record<string, string> = {};
    const createdIds: string[] = [];
    const records: Record<string, unknown>[] = [];

    // Process image shapes first (copy assets)
    const assetPaths: Record<string, string> = {};

    for (const rawShape of shapes) {
      const shape = rawShape as Record<string, unknown>;
      const realId = createShapeId();
      currentIndex = getIndexAbove(currentIndex);

      if (shape.tempId) {
        idMap[shape.tempId as string] = realId;
      }

      createdIds.push(realId);

      if (shape.type === "image") {
        const imgShape = shape as {
          type: "image";
          x: number;
          y: number;
          src: string;
          tempId?: string;
          props?: { w?: number; h?: number };
        };

        if (!existsSync(imgShape.src)) {
          return c.json(
            { error: `Image file not found: ${imgShape.src}` },
            400,
          );
        }

        const { filename, fullPath } = await copyToBoardAssets(
          imgShape.src,
          id,
        );

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

        // TODO: asset records for image sync support
        records.push({
          id: realId,
          type: "image",
          typeName: "shape",
          x: imgShape.x,
          y: imgShape.y,
          rotation: 0,
          isLocked: false,
          opacity: 1,
          parentId: pageId,
          index: currentIndex,
          meta: {},
          props: { w, h, assetId: null, crop: null },
        });
      } else {
        // Standard shapes (text, geo, note, frame, markdown, arrow)
        const props = (shape.props as Record<string, unknown>) ?? {};

        // Strip CLI-specific fields
        const stripped = { ...shape };
        delete stripped.tempId;
        delete stripped.fromId;
        delete stripped.toId;
        delete stripped.x1;
        delete stripped.y1;
        delete stripped.x2;
        delete stripped.y2;

        records.push({
          id: realId,
          type: shape.type,
          typeName: "shape",
          x: (shape.x as number) ?? 0,
          y: (shape.y as number) ?? 0,
          rotation: 0,
          isLocked: false,
          opacity: 1,
          parentId: pageId,
          index: currentIndex,
          meta: {},
          props,
        });
      }
    }

    // Write records to the sync room
    try {
      await room.updateStore((store: any) => {
        store.put(records);
      });
    } catch (e) {
      return c.json(
        {
          error:
            e instanceof Error ? e.message : "Failed to create shapes in room",
        },
        500,
      );
    }

    const hasIdMap = Object.keys(idMap).length > 0;

    return c.json({
      boardId: id,
      createdIds,
      ...(hasIdMap ? { idMap } : {}),
      ...(Object.keys(assetPaths).length > 0 ? { assetPaths } : {}),
    });
  },
);

// Update shapes on a board (via sync room)
boards.patch(
  "/:id/shapes",
  zValidator("json", updateShapesBodySchema as any),
  async (c) => {
    const id = c.req.param("id");

    const metadata = await readJSON<BoardMetadata>(
      join(getBoardDir(id), "metadata.json"),
    );
    if (!metadata) {
      return c.json({ error: "Board not found" }, 404);
    }

    const { shapes } = c.req.valid("json");
    const room = makeOrLoadRoom(id);

    try {
      await room.updateStore((store: any) => {
        for (const update of shapes) {
          const existing = store.get(update.id);
          if (!existing) continue;

          const merged = { ...existing } as any;
          if (update.x !== undefined) merged.x = update.x;
          if (update.y !== undefined) merged.y = update.y;

          // Merge props
          if (update.props) {
            merged.props = {
              ...existing.props,
              ...(update.props as Record<string, unknown>),
            };
          }

          store.put([merged]);
        }
      });
    } catch (e) {
      return c.json(
        {
          error:
            e instanceof Error ? e.message : "Failed to update shapes in room",
        },
        500,
      );
    }

    return c.json({
      boardId: id,
      updatedIds: shapes.map((s: { id: string }) => s.id),
    });
  },
);

// Delete shapes on a board (via sync room)
boards.delete(
  "/:id/shapes",
  zValidator("json", deleteShapesBodySchema as any),
  async (c) => {
    const id = c.req.param("id");

    const metadata = await readJSON<BoardMetadata>(
      join(getBoardDir(id), "metadata.json"),
    );
    if (!metadata) {
      return c.json({ error: "Board not found" }, 404);
    }

    const { ids } = c.req.valid("json");
    const room = makeOrLoadRoom(id);

    try {
      await room.updateStore((store: any) => {
        store.delete(ids);
      });
    } catch (e) {
      return c.json(
        {
          error:
            e instanceof Error ? e.message : "Failed to delete shapes in room",
        },
        500,
      );
    }

    return c.json({ boardId: id, deletedIds: ids });
  },
);

export { boards };
