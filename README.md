# Agent Canvas

A whiteboard for coding agents. Draw diagrams from the CLI programmatically to understand code, iterate on plans, review changes, etc.

## Prerequisites

- [Bun](https://bun.sh/) (v1.0+)

## Quick Start (Linked CLI)

Build everything and link the `agent-canvas` command globally:

```bash
bun install
bun run build:link
```

This runs `build` (shared, server, web, cli), bundles the web app into the CLI, and links it via `bun link`.

### Add the Skill to Claude Code

The `skills/` directory contains a skill that teaches Claude Code how to use agent-canvas. Skills are directories with a `SKILL.md` inside.

Run this from the agent-canvas repo (where you just ran `build:link`):

```bash
CANVAS_DIR=$PWD

# Option 1: Symlink the skill directory (stays in sync with updates)
mkdir -p .claude/skills
ln -s "$CANVAS_DIR/skills" .claude/skills/agent-canvas

# Option 2: Copy the skill directory
cp -r "$CANVAS_DIR/skills" .claude/skills/agent-canvas
```

Now use the CLI:

```bash
# Start the server and open the browser
agent-canvas open

# Start without opening a browser (for agents)
agent-canvas open --headless

# Check status
agent-canvas status

# Create a board
agent-canvas boards create "My Board"

# List boards
agent-canvas boards list

# Draw shapes (board must be open in browser)
agent-canvas shapes create --board <board-id> --shapes '[
  {"type": "geo", "x": 100, "y": 100, "props": {"w": 200, "h": 100, "geo": "rectangle", "text": "Hello"}}
]'

# Read shapes back
agent-canvas shapes get --board <board-id>

# Stop the server
agent-canvas close
```

## Development Mode

Run the server and web app with hot reload:

```bash
bun install
bun run dev
```

This starts the Hono server (with `--watch`) and Vite dev server concurrently. The web app is available at the URL printed in the terminal.

To run CLI commands against the dev server:

```bash
bun run cli -- boards list
bun run cli -- shapes get --board <board-id>
```

## Project Structure

```
apps/
  cli/         CLI tool (Commander) — the `agent-canvas` command
  web/         React + TLDraw frontend (Vite)
packages/
  server/      Hono HTTP + WebSocket server
  shared/      Zod schemas and TypeScript types
skills/        Skill documentation for AI agents
```

## How It Works

Shape operations go through a WebSocket relay:

```
CLI → HTTP API → Server (validates with Zod) → WebSocket → Browser (TLDraw editor) → WebSocket response → HTTP response → CLI
```

The browser must have the board open for shape commands to work. The server acts as a relay between the CLI and the TLDraw editor running in the browser.

## Scripts

| Script                  | Description                                 |
| ----------------------- | ------------------------------------------- |
| `bun run dev`           | Start server + web with hot reload          |
| `bun run build`         | Build all packages                          |
| `bun run build:link`    | Build, bundle web into CLI, and `bun link`  |
| `bun run cli -- <args>` | Run CLI commands against dev server         |
| `bun run format`        | Format with Biome + Prettier                |
| `bun run clean`         | Remove all build artifacts and node_modules |
