# Agent Canvas

## Rules

- **Never commit without explicit user approval.** Always ask before running `git commit`.

## Cursor Cloud specific instructions

### Overview

Agent Canvas is a Bun-based TypeScript monorepo (whiteboard CLI for AI coding agents). No external services, databases, or Docker required. All data stored as local JSON files in `~/.agent-canvas/boards/`.

### Architecture

- `packages/shared` — Zod schemas and types (build first)
- `packages/server` — Hono HTTP + WebSocket server (runs on Bun)
- `apps/web` — React + TLDraw + Vite frontend
- `apps/cli` — Commander.js CLI

### Running services

Start both server and web dev server together:

```sh
bun run dev
```

This runs `scripts/dev.ts` which auto-assigns ports per git worktree and starts both concurrently. Default ports: server 3456, web 1305.

To start services separately:

```sh
# Backend (with hot reload)
cd packages/server && PORT=3456 bun --watch src/index.ts

# Frontend (Vite dev server with proxy to backend)
cd apps/web && AGENT_CANVAS_SERVER_URL=http://localhost:3456 AGENT_CANVAS_WEB_PORT=1305 VITE_AGENT_CANVAS_WS_URL=ws://localhost:3456/ws npx vite --port 1305
```

### CLI usage in dev

Use `AGENT_CANVAS_URL` env var to point the CLI at a running server:

```sh
AGENT_CANVAS_URL=http://localhost:3456 bun run cli -- boards list
```

Or the CLI reads the lockfile at `~/.agent-canvas/` written by the server on startup.

### Lint / format

```sh
bun run format:check   # check only
bun run format         # auto-fix
```

Uses Biome (not ESLint) for the monorepo root. The web app also has an ESLint config but Biome is the primary linter.

Pre-existing lint errors exist in the codebase (1 hook-call error, several `any` warnings). These are not regressions.

### Build

```sh
bun run build   # builds shared → server → web → cli in sequence
```

### Tests

Integration tests live in `tests/*.sh` (bash scripts using curl). They require: (1) the server running, (2) a browser tab open on the board (WebSocket relay), and (3) a board with a specific UUID. These are not automated unit tests.

### Gotchas

- The server uses `Bun.serve` with native WebSocket support. Shape operations (create/update/delete via CLI/API) are relayed through WebSocket to the browser — a board must be open in a browser tab for shape commands to work.
- When starting services separately, the Vite proxy handles `/api` and `/ws` forwarding. If `VITE_AGENT_CANVAS_WS_URL` is set, the frontend connects directly to that WebSocket URL instead of using the proxy.
- `bun run dev` is the recommended way to start development — it handles port assignment and env var wiring automatically.
