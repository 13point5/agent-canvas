# Tech Debt

## 1. TLDraw orphaned assets are never garbage-collected

When an image shape is deleted from the canvas, TLDraw removes the **shape record** but keeps the **asset record** in the store indefinitely. This means base64 blobs and URL-based asset entries accumulate in the snapshot even after shapes are deleted.

This affects snapshot file size over time — especially for base64 assets added via TLDraw's native UI (870KB+ per screenshot).

Our CLI-added images use URL-based `src` so the snapshot impact is small (just the URL string), but the orphaned asset files on disk (`~/.agent-canvas/boards/<id>/assets/`) are never cleaned up either.

**Options:**
- Periodic cleanup: scan assets in snapshot, remove any not referenced by a shape
- Hook into TLDraw's store listener to detect shape deletions and prune unreferenced assets
- Add a CLI command (`agent-canvas boards cleanup <id>`) that removes orphaned assets from both the snapshot store and disk

**Relevant code:**
```
apps/web/src/hooks/api/use-websocket.ts  — asset creation (editor.createAssets)
packages/server/src/lib/storage.ts       — disk storage (copyToBoardAssets)
```

## 2. Hono zod-validator requires `as any` cast on schemas

Every `zValidator()` call casts the Zod schema to `as any` to work around a type mismatch between `@hono/zod-validator` and our Zod schemas. This silently disables type inference on `c.req.valid("json")` — the validated body types fall back to `any` instead of being inferred from the schema.

```ts
// packages/server/src/routes/boards.ts
boards.post("/", zValidator("json", createBoardSchema as any), async (c) => {
  const { name } = c.req.valid("json"); // type is `any`, not { name: string }
});

boards.post("/:id/shapes", zValidator("json", createShapesBodySchema as any), async (c) => {
  const { shapes } = c.req.valid("json"); // type is `any`, not { shapes: InputShape[] }
});
```

This affects all 4 validated routes in `boards.ts`.

**Root cause:** Likely a version mismatch between `hono`, `@hono/zod-validator`, and `zod` — or the `.strict()` modifier on our schemas producing a type that `zValidator` doesn't accept.

**Fix:** Update `@hono/zod-validator` to latest, check if the type constraint changed. If the issue is `.strict()`, consider removing it from top-level request body schemas (keep it on nested shape schemas). Alternatively, use Hono's built-in validator with manual `schema.parse()`.
