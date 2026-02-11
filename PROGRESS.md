# Progress: Update & Delete Operations

> Agents update this file as they complete work. Grouped by layer for easy review.

---

## Status Summary

| Task | Owner | Status | Notes |
|------|-------|--------|-------|
| 1. Shared Schemas | shared-layer | Done | `packages/shared/src/schemas.ts` |
| 2. Shared Types | shared-layer | Done | `packages/shared/src/types.ts` |
| 3. Server Routes | server | Done | `packages/server/src/routes/boards.ts` |
| 4. Server WebSocket | server | Done | `packages/server/src/lib/ws.ts` |
| 5. Frontend WebSocket | frontend | Done | `apps/web/src/hooks/api/use-websocket.ts` |
| 6. CLI API Client | cli-docs | Done | `apps/cli/src/api-client.ts` |
| 7. CLI Commands | cli-docs | Done | `apps/cli/src/index.ts` |
| 8. Skill Documentation | cli-docs | Done | `skills/SKILL.md` |

---

## Shared Layer (Tasks 1-2)

### Task 1: Schemas — `packages/shared/src/schemas.ts`

**Status**: Done

<details>
<summary>Changes</summary>

- Added per-shape-type update schemas (`geoUpdateSchema`, `textUpdateSchema`, `arrowUpdateSchema`, `noteUpdateSchema`, `frameUpdateSchema`, `imageUpdateSchema`) — each requires `id` and `type`, with `x`, `y`, and `props` all optional. Props use `.partial()` on the existing create props schemas so all prop fields (including `geo`, `w`, `h`) become optional for updates.
- Exported `updateShapeSchema` — discriminated union on `type` over all update shape schemas.
- Exported `updateShapesBodySchema` — `{ shapes: z.array(updateShapeSchema).min(1) }`.
- Exported `deleteShapesBodySchema` — `{ ids: z.array(z.string()).min(1) }`.

</details>

### Task 2: Types — `packages/shared/src/types.ts`

**Status**: Done

<details>
<summary>Changes</summary>

- Imported `updateShapeSchema`, `updateShapesBodySchema`, `deleteShapesBodySchema` from `./schemas`.
- Added inferred types: `UpdateShape`, `UpdateShapesBody`, `DeleteShapesBody`.
- Added WS message types: `UpdateShapesRequest`, `UpdateShapesResponse`, `DeleteShapesRequest`, `DeleteShapesResponse`.
- Added API response types: `UpdateShapesApiResponse`, `DeleteShapesApiResponse`.

</details>

---

## Server Layer (Tasks 3-4)

### Task 3: Route Handlers — `packages/server/src/routes/boards.ts`

**Status**: Done

<details>
<summary>Changes</summary>

- Imported `updateShapesBodySchema` and `deleteShapesBodySchema` from `@agent-canvas/shared`.
- Added `PATCH /:id/shapes` handler — validates body with `updateShapesBodySchema`, checks board exists (404) and clients connected (503), extracts `shapes`, sends `update-shapes:request` via `sendToClients`, waits for response via `createPendingRequest<{ updatedIds: string[] }>`, returns `{ boardId, updatedIds }`. TIMEOUT → 504, other errors → 500.
- Added `DELETE /:id/shapes` handler — validates body with `deleteShapesBodySchema`, checks board exists (404) and clients connected (503), extracts `ids`, sends `delete-shapes:request` via `sendToClients`, waits for response via `createPendingRequest<{ deletedIds: string[] }>`, returns `{ boardId, deletedIds }`. Same error handling pattern.

</details>

### Task 4: WebSocket Handler — `packages/server/src/lib/ws.ts`

**Status**: Done

<details>
<summary>Changes</summary>

- Imported `UpdateShapesRequest`, `UpdateShapesResponse`, `DeleteShapesRequest`, `DeleteShapesResponse` from `@agent-canvas/shared`.
- Extended `sendToClients` function signature to also accept `UpdateShapesRequest | DeleteShapesRequest`.
- Extended `message` handler type assertion to include `UpdateShapesResponse | DeleteShapesResponse`.
- Added `update-shapes:response` case — calls `resolvePendingRequest` with `{ updatedIds: data.updatedIds }`.
- Added `delete-shapes:response` case — calls `resolvePendingRequest` with `{ deletedIds: data.deletedIds }`.

</details>

---

## Frontend Layer (Task 5)

### Task 5: Frontend WebSocket — `apps/web/src/hooks/api/use-websocket.ts`

**Status**: Done

<details>
<summary>Changes</summary>

- Added imports for `UpdateShapesRequest`, `UpdateShapesResponse`, `DeleteShapesRequest`, `DeleteShapesResponse` from `@agent-canvas/shared`.
- Added `handleUpdateShapesRequest` — loads board editor, maps over shapes to build TLDraw update objects (stripping `type`, converting `props.text` → `props.richText` via `toRichText()`), calls `editor.updateShapes()`, saves snapshot, responds with `updatedIds`.
- Added `handleDeleteShapesRequest` — loads board editor, calls `editor.deleteShapes(ids as TLShapeId[])`, saves snapshot, responds with `deletedIds`.
- Wired both handlers into `ws.onmessage` dispatcher after the existing `create-shapes:request` case.
- Both handlers follow the same error handling pattern: catch errors and respond with `null` IDs + error message.

</details>

---

## CLI Layer (Tasks 6-7)

### Task 6: API Client — `apps/cli/src/api-client.ts`

**Status**: Done

<details>
<summary>Changes</summary>

- Imported `UpdateShapesApiResponse` and `DeleteShapesApiResponse` from `@agent-canvas/shared`.
- Added `updateBoardShapes(id, shapes)` — sends `PATCH /api/boards/:id/shapes` with `{ shapes }` body, returns `UpdateShapesApiResponse`. Same try/catch + `handleError` pattern as existing functions.
- Added `deleteBoardShapes(id, ids)` — sends `DELETE /api/boards/:id/shapes` with `{ data: { ids } }` (axios convention for DELETE body), returns `DeleteShapesApiResponse`. Same error handling pattern.

</details>

### Task 7: CLI Commands — `apps/cli/src/index.ts`

**Status**: Done

<details>
<summary>Changes</summary>

- Imported `updateBoardShapes` and `deleteBoardShapes` from `./api-client`.
- Added `shapes update` command — `--board <id>` (required) and `--shapes <json>` (required, JSON array of update objects with `id` and `type`). Parses JSON, validates it's an array, calls `updateBoardShapes`, prints result. Same error handling pattern as `shapes create`.
- Added `shapes delete` command — `--board <id>` (required) and `--ids <json>` (required, JSON array of shape ID strings). Parses JSON, validates it's an array, calls `deleteBoardShapes`, prints result. Same error handling pattern.

</details>

---

## Documentation (Task 8)

### Task 8: Skill Doc — `skills/SKILL.md`

**Status**: Done

<details>
<summary>Changes</summary>

- Added "Updating Shapes" section — documents `shapes update` command syntax, explains that each update object requires `id` and `type` with all other fields optional, shows examples for changing color, moving shapes, updating text, and batch updates.
- Added "Deleting Shapes" section — documents `shapes delete` command syntax, explains that real TLDraw shape IDs are required, notes automatic arrow binding cleanup and irreversibility.
- Updated "Workflow Pattern" section — added steps 5 (update shapes) and 6 (delete shapes) to the existing workflow list.

</details>
