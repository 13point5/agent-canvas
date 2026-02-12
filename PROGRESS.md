# Progress: tldraw sync multiplayer migration

## Status: BUILD PASSING — Ready for integration testing

### Completed
- [x] Research tldraw sync docs (all 7 collaboration examples)
- [x] Clone and analyze tldraw-sync-cloudflare starter kit (`~/Documents/tldraw-sync-cloudflare/`)
- [x] Clone and analyze tldraw simple-server-example (`~/Documents/tldraw-mono/templates/simple-server-example/`)
- [x] Understand current agent-canvas architecture (snapshot-based persistence, WS relay for CLI)
- [x] Write comprehensive migration plan (`PLAN.md`)
- [x] Create `fix/cli-markdown-shape-creation` branch and push (prerequisite fix)
- [x] Create `feat/tldraw-multiplayer-sync` branch from fix branch
- [x] **Phase 1**: Add `@tldraw/sync-core`, `@tldraw/tlschema`, `@tldraw/editor`, `better-sqlite3` to server
- [x] **Phase 1**: Create `packages/server/src/lib/rooms.ts` — TLSocketRoom + SQLiteSyncStorage per board
- [x] **Phase 1**: Update WebSocket handler — dual handler: `/ws` for events, `/ws/sync/:roomId` for sync
- [x] **Phase 1**: Define markdown shape schema on server (using `T` validators from `@tldraw/editor`)
- [x] **Phase 2**: Add `@tldraw/sync` to web app
- [x] **Phase 2**: Replace `useBoardPersistence` with `useSync` in board-canvas
- [x] **Phase 2**: Simplify editor-store (removed headless editor machinery)
- [x] **Phase 2**: Simplify use-websocket (removed shape handlers, kept board events)
- [x] **Phase 3**: Rewrite shape endpoints to use sync room directly (no browser relay)
- [x] **Phase 4**: Create snapshot → SQLite migration script (`migrate-to-sync.ts`)
- [x] **Phase 5**: Add basic asset store for `useSync` (data URL fallback)
- [x] Full monorepo build passes (shared, server, web, cli)

### Up Next — Testing & Verification
- [ ] Restart dev server with new sync code
- [ ] Open board in browser → verify sync loads correctly
- [ ] Open same board in 2nd tab → verify cursors + live edits sync
- [ ] CLI: `shapes create` → verify shape appears in browser instantly
- [ ] CLI: `shapes get` → verify returns current shapes
- [ ] Navigate old boards → verify migration loaded data correctly
- [ ] Close all tabs → reopen → verify persistence works

### Files Changed (from fix branch)
| File | Action |
|------|--------|
| `packages/server/package.json` | Modified — added sync deps |
| `apps/web/package.json` | Modified — added @tldraw/sync |
| `packages/server/src/lib/rooms.ts` | **Created** — TLSocketRoom manager |
| `packages/server/src/lib/migrate-to-sync.ts` | **Created** — snapshot→SQLite migration |
| `packages/server/src/lib/ws.ts` | Rewritten — dual WS handler (events + sync) |
| `packages/server/src/index.ts` | Rewritten — dual WS upgrade, migration |
| `packages/server/src/routes/boards.ts` | Rewritten — shapes via sync room directly |
| `apps/web/src/components/board-canvas.tsx` | Rewritten — useSync hook |
| `apps/web/src/stores/editor-store.ts` | Simplified — just editor tracking |
| `apps/web/src/hooks/api/use-websocket.ts` | Simplified — board events only |
| `apps/web/src/hooks/api/use-board-persistence.ts` | Gutted — replaced by useSync |

### Architecture
```
Browser ──────WebSocket──────► TLSocketRoom (per board) ──► SQLite (~/.agent-canvas/rooms/{id}.db)
CLI ──────────HTTP API────────► Server ──► TLSocketRoom (same room) ──► auto-syncs to browser
```

### Key References
- tldraw sync docs: https://tldraw.dev/docs/sync
- TLSocketRoom API: https://tldraw.dev/reference/sync-core/TLSocketRoom
- useSync API: https://tldraw.dev/reference/sync/useSync
- Simple server example: `~/Documents/tldraw-mono/templates/simple-server-example/`
- Cloudflare starter kit: `~/Documents/tldraw-sync-cloudflare/`

### Known Limitations / TODOs
- Asset storage: currently uses data URL fallback, not integrated with board assets API
- Arrow bindings: not yet handled in server-side shape creation
- `TLSocketRoom.updateStore()` is deprecated — works but may need replacement in future tldraw versions
- Room cleanup: rooms close 30s after last client disconnects
