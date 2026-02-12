# Plan: Migrate to tldraw sync for proper multiplayer support

## Context

Agent Canvas currently uses **snapshot-based persistence**: the browser serializes the entire tldraw store via `getSnapshot()` and PUTs it to the server as a JSON file. There is no real-time sync between multiple browser tabs, and CLI shape operations go through a clunky WebSocket relay that requires a browser to be open.

**tldraw sync** (`@tldraw/sync` + `@tldraw/sync-core`) provides:
- Real-time multiplayer via WebSockets (cursors, presence, live edits)
- Server-authoritative document state via `TLSocketRoom` (one per board)
- Built-in conflict resolution (no manual merge logic)
- Pluggable storage backends (`SQLiteSyncStorage` with `better-sqlite3` for Node/Bun)
- Custom shape support (our `MarkdownShapeUtil` works out of the box)

After migration, **any** client (browser tab, CLI, AI agent) can read/write board data by connecting to the same `TLSocketRoom` — no browser relay needed.

## Architecture: Before vs After

### Before (current)
```
Browser ──HTTP PUT /snapshot──► Hono server ──► ~/.agent-canvas/boards/{id}/snapshot.json
CLI ──HTTP POST /shapes──► Hono server ──WS relay──► Browser ──WS response──► Hono ──► CLI
```

### After (tldraw sync)
```
Browser ──────WebSocket──────► TLSocketRoom (per board) ──► SQLite (.rooms/{id}.db)
CLI ──────────WebSocket──────► TLSocketRoom (same room)
AI Agent ─────WebSocket──────► TLSocketRoom (same room)
```

All clients connect directly to the server's `TLSocketRoom`. No browser relay needed.

## Changes

### Phase 1: Server — add tldraw sync rooms

**File: `packages/server/package.json`** — add dependencies:
```
"@tldraw/sync-core": "^4.3.1"
"@tldraw/tlschema": "^4.3.1"
"better-sqlite3": "^11.8.1"
```
Note: Bun has native SQLite but `better-sqlite3` is needed for `NodeSqliteWrapper`. Alternatively, check if we can write a `BunSqliteWrapper` using Bun's built-in `bun:sqlite`.

**File: `packages/server/src/lib/rooms.ts`** (new) — room management:
- `makeOrLoadRoom(boardId)` — returns or creates a `TLSocketRoom` with `SQLiteSyncStorage`
- Uses `createTLSchema` with `defaultShapeSchemas` + our markdown shape schema
- Stores SQLite DBs in `~/.agent-canvas/rooms/` (or reuse `boards/` dir)
- Auto-closes room when last client disconnects (with configurable grace period)
- In-memory map of active rooms, LRU eviction if needed

**File: `packages/server/src/lib/ws.ts`** — rewrite WebSocket handler:
- On connect: extract `roomId` and `sessionId` from URL/query params
- Route: `/ws/sync/:roomId?sessionId=xxx` → `room.handleSocketConnect({ sessionId, socket })`
- For Bun's WebSocket API (no per-socket listeners), use `room.handleSocketMessage(sessionId, message)` in the `message` callback
- Keep the old broadcast WebSocket at `/ws` for board-level events (created/deleted/renamed)

**File: `packages/server/src/index.ts`** — update server setup:
- Register new WebSocket route for sync connections
- Run data migration: convert existing `snapshot.json` files → SQLite rooms (one-time)

### Phase 2: Frontend — use `useSync` hook

**File: `apps/web/package.json`** — add dependency:
```
"@tldraw/sync": "^4.3.1"
```

**File: `apps/web/src/components/board-canvas.tsx`** — replace manual persistence:
```tsx
// Before:
const { handleMount } = useBoardPersistence(boardId);
<Tldraw onMount={handleMount} shapeUtils={customShapeUtils} />

// After:
const store = useSync({
  uri: `${wsProtocol}//${window.location.host}/ws/sync/${boardId}`,
  assets: assetStore,
  shapeUtils: [MarkdownShapeUtil, ...defaultShapeUtils],
  bindingUtils: defaultBindingUtils,
});
<Tldraw store={store} shapeUtils={customShapeUtils} />
```

**File: `apps/web/src/hooks/api/use-board-persistence.ts`** — DELETE entirely (replaced by `useSync`)

**File: `apps/web/src/stores/editor-store.ts`** — simplify:
- Remove headless editor creation for CLI (no longer needed — CLI connects directly to sync room)
- Keep `setVisibleEditor`/`unsetVisibleEditor` if still needed for other features, or remove entirely

**File: `apps/web/src/hooks/api/use-websocket.ts`** — simplify:
- Remove shape request handlers (`handleCreateShapesRequest`, etc.) — CLI talks directly to sync room now
- Keep board event listener for UI cache invalidation (`board:created`, `board:deleted`, etc.)

### Phase 3: CLI — connect directly to sync room

**File: `packages/server/src/routes/boards.ts`** — rewrite shape endpoints:
- Instead of WebSocket relay to browser, the server connects to the `TLSocketRoom` directly
- `GET /:id/shapes` → `room.getRecord()` or iterate current snapshot
- `POST /:id/shapes` → `room.updateStore()` to create shapes
- `PATCH /:id/shapes` → `room.updateStore()` to update shapes
- `DELETE /:id/shapes` → `room.updateStore()` to delete shapes
- Changes automatically sync to all connected browser clients in real-time

Alternative: the CLI itself could open a WebSocket to `/ws/sync/:roomId` and write shapes through the sync protocol directly. This is cleaner but requires implementing the tldraw sync client protocol in the CLI. The HTTP→server→room approach is simpler.

**File: `packages/server/src/lib/pending-requests.ts`** — DELETE (no longer needed)

### Phase 4: Data migration

**File: `packages/server/src/lib/migrate-to-sync.ts`** (new):
- On first server startup with sync enabled, scan `~/.agent-canvas/boards/*/snapshot.json`
- For each board with a snapshot, create a `SQLiteSyncStorage` and load the snapshot via `new SQLiteSyncStorage({ sql, snapshot })`
- Mark as migrated (e.g., rename `snapshot.json` → `snapshot.json.migrated`)
- New boards use sync natively — no snapshot.json needed

### Phase 5: Asset storage

**File: `packages/server/src/lib/asset-store.ts`** (new or adapt existing):
- Implement `TLAssetStore` interface for the frontend `useSync` hook:
  - `upload(asset, file)` → POST to `/api/boards/{boardId}/assets`
  - `resolve(asset)` → return asset URL
- Server-side: keep current `copyToBoardAssets` logic, serve from `/api/boards/:boardId/assets/:filename`

## Key Design Decisions

### 1. Bun SQLite vs better-sqlite3
- tldraw provides `NodeSqliteWrapper` for `better-sqlite3`
- Bun has native `bun:sqlite` with a compatible API
- **Decision**: Try `better-sqlite3` first (proven to work with tldraw). If it causes issues with Bun, write a thin `BunSqliteWrapper` adapter.

### 2. Room lifecycle
- Rooms are created on-demand when a client connects
- When last client disconnects → start a grace timer (e.g., 30s)
- If no reconnection, close room and release SQLite handle
- On next connection, room is re-loaded from SQLite (fast)

### 3. Snapshot endpoint backwards compatibility
- Keep `GET/PUT /:id/snapshot` endpoints temporarily for backwards compat
- `GET` reads from the sync room's current state: `room.getCurrentSnapshot()`
- `PUT` loads into the sync room: `room.loadSnapshot(snapshot)`
- Remove after migration is verified

### 4. Schema for custom shapes
- Server needs to know about our markdown shape schema for validation
- Move `MarkdownShapeUtil` props/migrations to `packages/shared/` so both server and client can import them
- Server uses `createTLSchema({ shapes: { ...defaultShapeSchemas, markdown: { props: markdownShapeProps } } })`

### 5. WebSocket routing
- `/ws` — existing board event broadcasts (keep as-is)
- `/ws/sync/:roomId?sessionId=xxx` — new tldraw sync connection per board

## Files to modify/create

| File | Action | Description |
|------|--------|-------------|
| `packages/server/package.json` | Modify | Add `@tldraw/sync-core`, `@tldraw/tlschema`, `better-sqlite3` |
| `apps/web/package.json` | Modify | Add `@tldraw/sync` |
| `packages/server/src/lib/rooms.ts` | Create | Room manager with `TLSocketRoom` + `SQLiteSyncStorage` |
| `packages/server/src/lib/ws.ts` | Modify | Add sync WebSocket handler alongside existing events |
| `packages/server/src/index.ts` | Modify | Register sync WebSocket route, run migration |
| `packages/server/src/lib/migrate-to-sync.ts` | Create | One-time snapshot→SQLite migration |
| `packages/server/src/routes/boards.ts` | Modify | Shape endpoints talk to sync room directly |
| `packages/shared/src/markdown-shape-schema.ts` | Create | Shared markdown shape schema for server+client |
| `apps/web/src/components/board-canvas.tsx` | Modify | Use `useSync` instead of manual persistence |
| `apps/web/src/hooks/api/use-board-persistence.ts` | Delete | Replaced by `useSync` |
| `apps/web/src/stores/editor-store.ts` | Simplify | Remove headless editor machinery |
| `apps/web/src/hooks/api/use-websocket.ts` | Simplify | Remove shape handlers, keep board events |
| `packages/server/src/lib/pending-requests.ts` | Delete | No longer needed |

## Verification plan

1. Start dev server (`bun run dev`)
2. Open board in browser → verify it loads (via sync, not snapshot)
3. Open same board in 2nd tab → verify cursors appear, edits sync live
4. CLI: `shapes create` → verify shape appears in browser instantly (no relay)
5. CLI: `shapes get` → verify returns current shapes
6. Close all browser tabs → reopen board → verify all data persisted
7. Old boards with `snapshot.json` → verify they migrate and load correctly

## Risk mitigation

- **tldraw version mismatch**: Pin `@tldraw/sync` and `@tldraw/sync-core` to same version as `tldraw` (4.3.1)
- **Bun + better-sqlite3 compatibility**: Test early; fallback to `bun:sqlite` wrapper if needed
- **Data loss during migration**: Keep original `snapshot.json` files (rename, don't delete)
- **Breaking CLI**: Keep HTTP shape endpoints working, just change internal implementation from relay to direct room access
