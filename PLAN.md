# Plan: Update & Delete Operations for All Shapes

## Overview

Add `update` and `delete` operations for all shape types (geo, text, arrow, note, frame, image) via the CLI, following the existing WebSocket relay pattern used by `create`.

**Architecture pattern** (same as existing `create`):
```
CLI → HTTP API → Server validates → WebSocket relay → Browser (TLDraw editor) → WebSocket response → HTTP response → CLI
```

---

## File Change Map

| Layer | File | Changes |
|-------|------|---------|
| **Shared schemas** | `packages/shared/src/schemas.ts` | Add `updateShapesBodySchema`, `deleteShapesBodySchema` |
| **Shared types** | `packages/shared/src/types.ts` | Add WS message types + API response types for update/delete |
| **Server routes** | `packages/server/src/routes/boards.ts` | Add `PATCH /:id/shapes` and `DELETE /:id/shapes` handlers |
| **Server WS** | `packages/server/src/lib/ws.ts` | Extend `sendToClients` and `message` handler for new message types |
| **Frontend WS** | `apps/web/src/hooks/api/use-websocket.ts` | Add `handleUpdateShapesRequest` and `handleDeleteShapesRequest` |
| **CLI api-client** | `apps/cli/src/api-client.ts` | Add `updateBoardShapes()` and `deleteBoardShapes()` functions |
| **CLI commands** | `apps/cli/src/index.ts` | Add `shapes update` and `shapes delete` commands |
| **Skill doc** | `skills/SKILL.md` | Document new commands and usage examples |

---

## Task 1: Shared Schemas (`packages/shared/src/schemas.ts`)

### Update Schema

Each update shape requires an `id` (the real TLDraw shape ID) and a partial `props` object. Position (`x`, `y`) can also be updated.

```ts
// Per-shape-type update schemas (all props optional)
const geoUpdateSchema = z.object({
  id: z.string(),
  type: z.literal("geo"),
  x: z.number().optional(),
  y: z.number().optional(),
  props: geoPropsSchema.partial().optional(),  // all props optional
}).strict();

// Similar for text, arrow, note, frame, image...

const updateShapeSchema = z.discriminatedUnion("type", [
  geoUpdateSchema,
  textUpdateSchema,
  arrowUpdateSchema,
  noteUpdateSchema,
  frameUpdateSchema,
  imageUpdateSchema,
]);

export const updateShapesBodySchema = z.object({
  shapes: z.array(updateShapeSchema).min(1),
});
```

**Key design decision**: Use discriminated union on `type` so validation is shape-type-aware. The `id` field is always required; everything else is optional.

### Delete Schema

```ts
export const deleteShapesBodySchema = z.object({
  ids: z.array(z.string()).min(1),
});
```

---

## Task 2: Shared Types (`packages/shared/src/types.ts`)

```ts
// --- Update ---
export type UpdateShapesRequest = {
  type: "update-shapes:request";
  requestId: string;
  boardId: string;
  shapes: UpdateShape[];
};
export type UpdateShapesResponse = {
  type: "update-shapes:response";
  requestId: string;
  updatedIds: string[] | null;
  error?: string;
};
export type UpdateShapesApiResponse = {
  boardId: string;
  updatedIds: string[];
};

// --- Delete ---
export type DeleteShapesRequest = {
  type: "delete-shapes:request";
  requestId: string;
  boardId: string;
  ids: string[];
};
export type DeleteShapesResponse = {
  type: "delete-shapes:response";
  requestId: string;
  deletedIds: string[] | null;
  error?: string;
};
export type DeleteShapesApiResponse = {
  boardId: string;
  deletedIds: string[];
};
```

---

## Task 3: Server Route Handlers (`packages/server/src/routes/boards.ts`)

### PATCH `/:id/shapes` (Update)

```ts
boards.patch(
  "/:id/shapes",
  zValidator("json", updateShapesBodySchema as any),
  async (c) => {
    // 1. Validate board exists (404 if not)
    // 2. Check browser clients connected (503 if none)
    // 3. Validate body with Zod
    // 4. Send update-shapes:request via WebSocket
    // 5. Wait for update-shapes:response (10s timeout)
    // 6. Return { boardId, updatedIds }
  }
);
```

### DELETE `/:id/shapes` (Delete)

```ts
boards.delete(
  "/:id/shapes",
  zValidator("json", deleteShapesBodySchema as any),
  async (c) => {
    // 1. Validate board exists (404 if not)
    // 2. Check browser clients connected (503 if none)
    // 3. Validate body with Zod
    // 4. Send delete-shapes:request via WebSocket
    // 5. Wait for delete-shapes:response (10s timeout)
    // 6. Return { boardId, deletedIds }
  }
);
```

---

## Task 4: Server WebSocket (`packages/server/src/lib/ws.ts`)

- Extend `sendToClients` type signature to accept `UpdateShapesRequest | DeleteShapesRequest`
- Extend `message` handler to resolve `update-shapes:response` and `delete-shapes:response`

---

## Task 5: Frontend WebSocket Handler (`apps/web/src/hooks/api/use-websocket.ts`)

### handleUpdateShapesRequest

```ts
async function handleUpdateShapesRequest(ws: WebSocket, request: UpdateShapesRequest) {
  const { requestId, boardId, shapes } = request;
  try {
    const editor = await useEditorStore.getState().loadBoard(boardId);

    // Build TLDraw-compatible update objects
    const updates = shapes.map(shape => {
      const { type, ...rest } = shape;
      // Convert props.text → props.richText if present
      if (rest.props && typeof rest.props.text === "string") {
        rest.props.richText = toRichText(rest.props.text);
        delete rest.props.text;
      }
      return rest;  // { id, x?, y?, props? }
    });

    editor.updateShapes(updates);

    const snapshot = getSnapshot(editor.store);
    await boardsMutations.saveSnapshot({ id: boardId, snapshot });

    ws.send(JSON.stringify({
      type: "update-shapes:response",
      requestId,
      updatedIds: shapes.map(s => s.id),
    }));
  } catch (e) {
    ws.send(JSON.stringify({
      type: "update-shapes:response",
      requestId,
      updatedIds: null,
      error: e instanceof Error ? e.message : "Failed to update shapes",
    }));
  }
}
```

### handleDeleteShapesRequest

```ts
async function handleDeleteShapesRequest(ws: WebSocket, request: DeleteShapesRequest) {
  const { requestId, boardId, ids } = request;
  try {
    const editor = await useEditorStore.getState().loadBoard(boardId);

    editor.deleteShapes(ids as TLShapeId[]);

    const snapshot = getSnapshot(editor.store);
    await boardsMutations.saveSnapshot({ id: boardId, snapshot });

    ws.send(JSON.stringify({
      type: "delete-shapes:response",
      requestId,
      deletedIds: ids,
    }));
  } catch (e) {
    ws.send(JSON.stringify({
      type: "delete-shapes:response",
      requestId,
      deletedIds: null,
      error: e instanceof Error ? e.message : "Failed to delete shapes",
    }));
  }
}
```

---

## Task 6: CLI API Client (`apps/cli/src/api-client.ts`)

```ts
export async function updateBoardShapes(
  id: string,
  shapes: unknown[],
): Promise<UpdateShapesApiResponse> {
  const client = createClient();
  const response = await client.patch(`/api/boards/${id}/shapes`, { shapes });
  return response.data;
}

export async function deleteBoardShapes(
  id: string,
  ids: string[],
): Promise<DeleteShapesApiResponse> {
  const client = createClient();
  const response = await client.delete(`/api/boards/${id}/shapes`, { data: { ids } });
  return response.data;
}
```

---

## Task 7: CLI Commands (`apps/cli/src/index.ts`)

### `shapes update`

```bash
agent-canvas shapes update --board <id> --shapes '[{"id": "shape:abc", "type": "geo", "props": {"color": "red"}}]'
```

### `shapes delete`

```bash
agent-canvas shapes delete --board <id> --ids '["shape:abc", "shape:def"]'
```

---

## Task 8: Skill Documentation (`skills/SKILL.md`)

Add sections:
- **Updating Shapes** — explain usage with `shapes update`, show examples for changing props, position, text
- **Deleting Shapes** — explain usage with `shapes delete`, show examples
- **Updated Workflow Pattern** — add update/delete to the workflow

---

## Implementation Order (Dependencies)

```
Task 1 (schemas) ──┐
                    ├─→ Task 3 (server routes) ─→ Task 4 (server WS)
Task 2 (types)  ───┘         │
                              ├─→ Task 5 (frontend WS)
                              │
                              ├─→ Task 6 (CLI api-client) ─→ Task 7 (CLI commands)
                              │
                              └─→ Task 8 (skill doc)
```

Tasks 1 & 2 must come first (shared layer). Then 3-8 can largely be parallelized:
- **Backend stream**: Tasks 3 → 4 (server)
- **Frontend stream**: Task 5 (browser)
- **CLI stream**: Tasks 6 → 7 (CLI)
- **Docs stream**: Task 8 (skill doc)
