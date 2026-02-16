---
name: agent-canvas
description: Draw shapes, arrows, and diagrams on a TLDraw canvas via the agent-canvas CLI. Use when an agent needs to visually communicate ideas, create diagrams, flowcharts, or annotate a whiteboard. Triggers on tasks involving drawing, diagramming, visual explanations, or canvas manipulation.
user-invocable: true
---

# Agent Canvas

Agent Canvas lets you create and manipulate shapes on a TLDraw whiteboard from the CLI. The browser must have the board open for shape operations to work (WebSocket relay).

## Prerequisites

1. Check if the server is already running: `agent-canvas status`
2. If not running, start it: `agent-canvas open` (use `--headless` to skip opening the browser)
3. Board must be open in a browser tab

## Shape Selection Guide

**Always use the most specific shape type for your content.** Do not fall back to `text` or `markdown` shapes for content that has a dedicated shape type, unless the user explicitly asks for plain text/markdown.

### Built-in TLDraw Shapes

**`geo`** — Geometric primitives for diagrams and flowcharts
- Use for rectangles, ellipses, diamonds, stars, clouds, and other geometric shapes
- Use as labeled nodes in flowcharts and architecture diagrams
- Use for visual containers, callout boxes, and status indicators with color fills

**`text`** — Standalone text labels
- Use for headings, titles, and section labels on the board
- Use for short annotations and callouts near other shapes
- Use for any freeform text that doesn't belong inside a shape

**`arrow`** — Connectors between shapes
- Use to show relationships, data flow, or sequence between shapes
- Use in flowcharts, architecture diagrams, and dependency graphs
- Use to link evidence shapes together (e.g., stack trace → code diff → fix)

**`note`** — Sticky notes
- Use for quick observations, reminders, and commentary
- Use for status annotations (e.g., "TODO", "Blocked", "Done")
- Use for lightweight feedback that doesn't need a full markdown shape

**`frame`** — Grouping container
- Use to visually group related shapes into a named section
- Use to organize board into logical areas (e.g., "Investigation", "Fix", "Validation")
- Use with `parentId` on child shapes to nest content

**`image`** — Images from local files
- Use for UI screenshots captured during testing or debugging
- Use for architecture diagrams exported from other tools
- Use for any visual evidence (error screenshots, design mockups, charts)

### Document Shapes

**`markdown`** — Rich markdown content
- Use for long-form explanations, summaries, and documentation
- Use for incident write-ups, root cause analyses, and decision records
- Use for any narrative content that benefits from markdown formatting (headers, lists, bold, code blocks)
- Supports threaded comments for collaborative review

**`html`** — Interactive HTML in a sandboxed iframe
- Use for interactive prototypes and UI demos
- Use for data visualizations with embedded JavaScript (charts, graphs)
- Use for any rich content that needs interactivity beyond static markdown

### Development Tool Shapes

**`code-diff`** — Side-by-side code comparison
- Use for showing code changes in PR reviews (old vs new content)
- Use for before/after comparisons of bug fixes
- Use for any focused code hunk comparison — prefer multiple small diffs over one large dump
- Do NOT use `markdown` with code fences for diffs — always use `code-diff`

### AI Element Shapes — Use These Over Generic Shapes

**`ai-terminal`** — Terminal output and log transcripts
- **Use whenever you receive logs from ANY source**: MCP servers, shell commands, build output, deployment logs, CI pipelines
- Use for streaming output snapshots at key milestones
- Use for command execution transcripts you want to persist on the board
- Do NOT use `text`, `markdown`, or `snippet` to display logs — always use `ai-terminal`

**`snippet`** — Single commands or one-liner code
- Use for exact shell commands the user should run (e.g., `vercel deploy --prebuilt`)
- Use for one-line code examples, config values, or CLI invocations
- Use for quick-reference commands in a workflow
- Do NOT use `text` or `markdown` with inline code for commands — use `snippet`

**`file-tree`** — File and folder structure
- Use when showing which files were touched, investigated, or are relevant
- Use for project structure overviews and change scope visualization
- Use for workspace context in debugging and code review workflows
- Do NOT use `text` or `markdown` with indented file lists — always use `file-tree`

**`schema-display`** — API endpoint documentation
- Use for documenting REST API contracts (method, path, parameters, request/response)
- Use for showing expected payload structures during integration work
- Use for API review and comparison of endpoint signatures
- Do NOT use `markdown` tables for API docs — always use `schema-display`

**`stack-trace`** — Error stack traces
- Use whenever you encounter an error with a stack trace from any source
- Use for runtime exceptions, build errors, and test failures with traces
- Use for parsed error output with clickable frame display
- Do NOT use `text`, `markdown`, or `ai-terminal` for stack traces — always use `stack-trace`

**`test-results`** — Test suite outcomes
- **Use whenever you receive test results from ANY source**: test runners, CI pipelines, MCP tools, or manual test output
- Use for pass/fail/skip summaries with per-test details
- Use for CI validation results and regression test reports
- Do NOT use `text`, `markdown`, or `ai-terminal` for test results — always use `test-results`

**`web-preview`** — Embedded web page with console logs
- Use for previewing deployed URLs (staging, preview deployments)
- Use for showing live web app state alongside console output
- Use when you have a URL to display with optional browser console logs

## Commands

### Board Management

```bash
# List all boards
agent-canvas boards list

# Create a new board
agent-canvas boards create "My Board"

# Rename a board
agent-canvas boards rename "New Name" --id <board-id>
```

### Reading Shapes

```bash
# Get shapes from a board (compact YAML-like summaries by default)
agent-canvas shapes get --board <board-id>

# Get JSON output (machine-readable)
agent-canvas shapes get --board <board-id> --json

# Get only specific shapes by ID (still minimal summaries)
agent-canvas shapes get --board <board-id> --ids '["shape:abc", "shape:def"]'

# Get full shape payloads as JSON (for redirecting to a file)
agent-canvas shapes get --board <board-id> --full --json > shapes.json

# Optional: tune truncation length in minimal mode (default 100)
agent-canvas shapes get --board <board-id> --max-chars 200
```

Default `shapes get` output is compact YAML-like text:
- It is optimized for lower token usage in agent contexts
- Use `--json` for machine-readable JSON output

Minimal-mode `shapes get` output is intentionally partial:
- It includes only `id`, `type`, and selected `props`
- Long values are truncated as `... (+N chars)`
- `code-diff` summaries include only `oldFile.name` / `newFile.name` (no file contents)
- `props._partial: true` means props are summarized, not complete
- Use `--full --json` when you need complete payloads

### Capturing Shape Screenshots

Capture a PNG screenshot of specific shapes by ID. This uses TLDraw export in the browser client and writes the image to a temp file on disk.

```bash
# Capture selected shapes and print the temp file path
agent-canvas screenshot --board <board-id> --ids '["shape:abc","shape:def"]'
```

Flags:

- `--board` — target board ID
- `--ids` — JSON array of real TLDraw shape IDs (from `shapes get` or create response)

Default output:

- prints only the absolute temp file path (for example `/var/folders/.../agent-canvas-screenshot-<board>-<uuid>.png`)

Quick workflow:

```bash
# 1) Read board shapes
agent-canvas shapes get --board <board-id>

# 2) Copy desired IDs from the response and capture
agent-canvas screenshot --board <board-id> --ids '["shape:abc","shape:def"]'
```

### Markdown Comments

Markdown comments are thread-based and live on markdown shape props:

- `props.comments[]` stores threads
- each thread has `id`, `target`, `messages[]`, and `resolvedAt`
- each message has `id`, `body`, `author`, `createdAt`, and optional `editedAt`

Author identity:

- user message: `{"type":"user"}` (CLI: `--author user`)
- agent message: `{"type":"agent","name":"Codex"}` (CLI: `--author agent --agent "Codex"`)
- if `--author agent` is used without `--agent`, CLI falls back to `AGENT_CANVAS_AGENT_NAME`, then `"Codex"`

Thread targets for `--target`:

- text range: `{"type":"text","start":10,"end":30,"quote":"selected text"}`
- line anchor: `{"type":"line","line":12,"lineText":"actual line text"}`
- diagram block: `{"type":"diagram","diagramId":"mermaid-1"}`
- whole markdown shape: `{"type":"shape"}`

```bash
# Create a new markdown comment thread (new thread requires --target)
agent-canvas comments add \
  --board <board-id> \
  --shape <markdown-shape-id> \
  --target '{"type":"text","start":10,"end":30,"quote":"selected text"}' \
  --body "Please revise this paragraph" \
  --author agent \
  --agent "Codex"

# Reply to an existing thread (append a message with --comment)
agent-canvas comments add \
  --board <board-id> \
  --shape <markdown-shape-id> \
  --comment <thread-id> \
  --body "Updated in latest commit" \
  --author user

# Find unresolved thread IDs on one markdown shape
agent-canvas shapes get \
  --board <board-id> \
  --ids '["<markdown-shape-id>"]' \
  --full \
  --json \
  | jq -r '.shapes[0].props.comments[] | select(.resolvedAt == null) | .id'

# Reply to the first unresolved thread as an agent
THREAD_ID="$(agent-canvas shapes get --board <board-id> --ids '["<markdown-shape-id>"]' --full --json | jq -r '.shapes[0].props.comments[] | select(.resolvedAt == null) | .id' | head -n 1)"
agent-canvas comments add \
  --board <board-id> \
  --shape <markdown-shape-id> \
  --comment "$THREAD_ID" \
  --body "Follow-up from Codex" \
  --author agent \
  --agent "Codex"
```

Current CLI scope:

- `agent-canvas comments add` supports creating threads and replying to threads
- resolving/reopening threads and editing existing messages are supported in the markdown UI
- if you need those state changes from CLI, update `props.comments` through `agent-canvas shapes update`

### Creating Shapes

Pass a JSON array of shape objects. Each shape follows TLDraw's shape format.

```bash
agent-canvas shapes create --board <board-id> --shapes '<json-array>'
```

### Creating Shapes Inside Frames (`parentId`)

To nest shapes in a frame, set `parentId` on each child shape to the frame shape ID.

When creating everything in one request, use `tempId` on the frame and reference that value from child `parentId`.

```bash
agent-canvas shapes create --board <board-id> --shapes '[
  {
    "type": "frame",
    "tempId": "story-frame",
    "x": 40,
    "y": 40,
    "props": { "w": 1600, "h": 1000, "name": "Story" }
  },
  {
    "type": "markdown",
    "x": 60,
    "y": 60,
    "parentId": "story-frame",
    "props": { "w": 400, "h": 240, "name": "Ticket", "content": "# LIN-428" }
  },
  {
    "type": "snippet",
    "x": 500,
    "y": 60,
    "parentId": "story-frame",
    "props": { "code": "vercel deploy --prebuilt --yes" }
  }
]'
```

Notes:
- Child `x` / `y` are relative to the frame when `parentId` is set.
- `parentId` is supported on create and update payloads.

## Text in Shapes

Use `"text"` in `props` for plain text. The browser auto-converts it to TLDraw's `richText` format.

For rich formatting, use `richText` directly (ProseMirror/TipTap doc structure). Both `text` and `richText` work on `geo`, `text`, and `note` shapes.

### Rich Text Formatting

Inline marks — apply to text nodes within a paragraph:

```json
{"type": "text", "text": "bold", "marks": [{"type": "bold"}]}
{"type": "text", "text": "italic", "marks": [{"type": "italic"}]}
{"type": "text", "text": "bold+italic", "marks": [{"type": "bold"}, {"type": "italic"}]}
{"type": "text", "text": "strikethrough", "marks": [{"type": "strike"}]}
{"type": "text", "text": "code", "marks": [{"type": "code"}]}
{"type": "text", "text": "highlighted", "marks": [{"type": "highlight"}]}
{"type": "text", "text": "link text", "marks": [{"type": "link", "attrs": {"href": "https://example.com"}}]}
```

Combine marks within a paragraph:

```json
{
  "props": {
    "richText": {
      "type": "doc",
      "content": [
        {
          "type": "paragraph",
          "content": [
            { "type": "text", "text": "Normal " },
            { "type": "text", "text": "bold", "marks": [{ "type": "bold" }] },
            { "type": "text", "text": " and " },
            { "type": "text", "text": "code", "marks": [{ "type": "code" }] }
          ]
        }
      ]
    }
  }
}
```

Block-level structures — bullet lists and ordered lists:

```json
{
  "props": {
    "richText": {
      "type": "doc",
      "content": [
        {
          "type": "bulletList",
          "content": [
            {
              "type": "listItem",
              "content": [
                {
                  "type": "paragraph",
                  "content": [{ "type": "text", "text": "First" }]
                }
              ]
            },
            {
              "type": "listItem",
              "content": [
                {
                  "type": "paragraph",
                  "content": [{ "type": "text", "text": "Second" }]
                }
              ]
            }
          ]
        }
      ]
    }
  }
}
```

```json
{
  "props": {
    "richText": {
      "type": "doc",
      "content": [
        {
          "type": "orderedList",
          "content": [
            {
              "type": "listItem",
              "content": [
                {
                  "type": "paragraph",
                  "content": [{ "type": "text", "text": "Step 1" }]
                }
              ]
            },
            {
              "type": "listItem",
              "content": [
                {
                  "type": "paragraph",
                  "content": [{ "type": "text", "text": "Step 2" }]
                }
              ]
            }
          ]
        }
      ]
    }
  }
}
```

### Headings

TLDraw does not visually differentiate heading levels — all headings render at the same size. To create visually distinct headings, use separate text shapes with different `size` values:

- H1: `"size": "xl"`
- H2: `"size": "l"`
- H3: `"size": "m"`

You can combine this with bold for emphasis:

```json
{
  "type": "text",
  "x": 100,
  "y": 100,
  "props": {
    "richText": {
      "type": "doc",
      "content": [
        {
          "type": "paragraph",
          "content": [
            {
              "type": "text",
              "text": "Section Title",
              "marks": [{ "type": "bold" }]
            }
          ]
        }
      ]
    },
    "size": "xl"
  }
}
```

### Not Supported

`blockquote`, `codeBlock`, and `horizontalRule` are disabled in TLDraw's rich text.

### Basic Shapes (geo)

```bash
agent-canvas shapes create --board <board-id> --shapes '[
  {"type": "geo", "x": 100, "y": 100, "props": {"w": 200, "h": 100, "geo": "rectangle"}},
  {"type": "geo", "x": 400, "y": 100, "props": {"w": 200, "h": 100, "geo": "ellipse"}}
]'
```

With text label:

```bash
agent-canvas shapes create --board <board-id> --shapes '[
  {"type": "geo", "x": 100, "y": 100, "props": {"w": 200, "h": 100, "geo": "rectangle", "text": "Hello", "align": "middle", "verticalAlign": "middle"}}
]'
```

Supported `geo` values: `rectangle`, `ellipse`, `diamond`, `triangle`, `pentagon`, `hexagon`, `octagon`, `star`, `cloud`, `arrow-right`, `arrow-left`, `arrow-up`, `arrow-down`, `x-box`, `check-box`.

Optional styling props: `color` (`black`, `grey`, `light-violet`, `violet`, `blue`, `light-blue`, `yellow`, `orange`, `green`, `light-green`, `light-red`, `red`, `white`), `fill` (`none`, `solid`, `semi`, `pattern`, `fill`, `lined-fill`), `size` (`s`, `m`, `l`, `xl`), `dash` (`draw`, `solid`, `dashed`, `dotted`), `font` (`draw`, `sans`, `serif`, `mono`).

#### Label Color

Use `labelColor` to color the text label independently from the shape border/fill color. Available on `geo` and `note` shapes. Accepts the same color values as `color`.

```bash
agent-canvas shapes create --board <board-id> --shapes '[
  {"type": "geo", "x": 100, "y": 100, "props": {"w": 250, "h": 250, "geo": "rectangle", "color": "blue", "labelColor": "red", "text": "Red label on blue shape"}}
]'
```

#### Scale

Use `scale` to uniformly scale a shape (including its label). Available on `geo`, `text`, `note`, and `arrow` shapes.

```bash
agent-canvas shapes create --board <board-id> --shapes '[
  {"type": "geo", "x": 100, "y": 100, "props": {"w": 250, "h": 250, "geo": "rectangle", "scale": 2.5, "text": "Scaled up"}}
]'
```

### Text

```bash
agent-canvas shapes create --board <board-id> --shapes '[
  {"type": "text", "x": 100, "y": 300, "props": {"text": "Hello World", "size": "m"}},
  {"type": "text", "x": 100, "y": 400, "props": {"text": "Fixed width", "size": "m", "w": 300, "autoSize": false}},
  {"type": "text", "x": 100, "y": 500, "props": {"text": "Monospace", "font": "mono", "size": "m"}}
]'
```

Text props: `size` (`s`, `m`, `l`, `xl`), `font` (`draw`, `sans`, `serif`, `mono`), `textAlign` (`start`, `middle`, `end`), `color`, `autoSize` (default `true`), `w` (width, used when `autoSize` is `false`).

### Temp IDs and Cross-Referencing

Use `tempId` on any shape to get back a mapping of your temp IDs to the real TLDraw IDs. This is essential for creating arrows between shapes in the same batch.

```bash
agent-canvas shapes create --board <board-id> --shapes '[
  {"tempId": "box-a", "type": "geo", "x": 100, "y": 100, "props": {"w": 200, "h": 100, "geo": "rectangle"}},
  {"tempId": "box-b", "type": "geo", "x": 500, "y": 100, "props": {"w": 200, "h": 100, "geo": "rectangle"}}
]'
```

Response includes `idMap`:

```json
{
  "boardId": "...",
  "createdIds": ["shape:abc123", "shape:def456"],
  "idMap": { "box-a": "shape:abc123", "box-b": "shape:def456" }
}
```

Use real IDs from `idMap` for subsequent API calls.

### Arrows (Connectors)

Arrows connect two shapes. Specify source and target using `fromId` and `toId` (referencing `tempId` values from the same batch), plus coordinates for the start and end points.

```bash
agent-canvas shapes create --board <board-id> --shapes '[
  {"tempId": "a", "type": "geo", "x": 100, "y": 100, "props": {"w": 200, "h": 100, "geo": "rectangle"}},
  {"tempId": "b", "type": "geo", "x": 500, "y": 100, "props": {"w": 200, "h": 100, "geo": "rectangle"}},
  {"tempId": "arrow-1", "type": "arrow", "fromId": "a", "toId": "b", "x1": 300, "y1": 150, "x2": 500, "y2": 150}
]'
```

Arrow fields:

- `fromId` — tempId of the source shape (arrow starts here)
- `toId` — tempId of the target shape (arrow ends here)
- `x1`, `y1` — start point coordinates (should be on/near the source shape edge)
- `x2`, `y2` — end point coordinates (should be on/near the target shape edge)

The arrow will be bound to both shapes, so dragging a shape moves the arrow with it.

#### Arrow Coordinate Tips

- Place `x1, y1` on the edge of the source shape closest to the target
- Place `x2, y2` on the edge of the target shape closest to the source
- For a shape at `(x, y)` with `w` width and `h` height:
  - Right edge midpoint: `(x + w, y + h/2)`
  - Left edge midpoint: `(x, y + h/2)`
  - Top edge midpoint: `(x + w/2, y)`
  - Bottom edge midpoint: `(x + w/2, y + h)`

#### Flowchart Example

```bash
agent-canvas shapes create --board <board-id> --shapes '[
  {"tempId": "start", "type": "geo", "x": 300, "y": 50, "props": {"w": 200, "h": 80, "geo": "ellipse", "text": "Start", "align": "middle", "verticalAlign": "middle"}},
  {"tempId": "process", "type": "geo", "x": 300, "y": 250, "props": {"w": 200, "h": 80, "geo": "rectangle", "text": "Process", "align": "middle", "verticalAlign": "middle"}},
  {"tempId": "decision", "type": "geo", "x": 300, "y": 450, "props": {"w": 200, "h": 100, "geo": "diamond", "text": "Condition?", "align": "middle", "verticalAlign": "middle"}},
  {"tempId": "end-yes", "type": "geo", "x": 100, "y": 650, "props": {"w": 160, "h": 80, "geo": "ellipse", "text": "Yes", "align": "middle", "verticalAlign": "middle", "color": "green", "fill": "solid"}},
  {"tempId": "end-no", "type": "geo", "x": 500, "y": 650, "props": {"w": 160, "h": 80, "geo": "ellipse", "text": "No", "align": "middle", "verticalAlign": "middle", "color": "red", "fill": "solid"}},
  {"tempId": "a1", "type": "arrow", "fromId": "start", "toId": "process", "x1": 400, "y1": 130, "x2": 400, "y2": 250},
  {"tempId": "a2", "type": "arrow", "fromId": "process", "toId": "decision", "x1": 400, "y1": 330, "x2": 400, "y2": 450},
  {"tempId": "a3", "type": "arrow", "fromId": "decision", "toId": "end-yes", "x1": 300, "y1": 500, "x2": 180, "y2": 650},
  {"tempId": "a4", "type": "arrow", "fromId": "decision", "toId": "end-no", "x1": 500, "y1": 500, "x2": 580, "y2": 650}
]'
```

### Images

Place images on the canvas from local file paths. The server copies the file to board-scoped storage and serves it by URL — snapshots stay small.

```bash
agent-canvas shapes create --board <board-id> --shapes '[
  {"type": "image", "x": 100, "y": 100, "src": "/path/to/screenshot.png"}
]'
```

Dimensions are auto-detected from the file. Override with explicit `w`/`h`:

```bash
agent-canvas shapes create --board <board-id> --shapes '[
  {"type": "image", "x": 100, "y": 100, "src": "/path/to/photo.jpg", "props": {"w": 600, "h": 400}}
]'
```

Image fields:

- `src` — absolute path to a local image file (png, jpg, jpeg, gif, webp, svg)
- `props.w`, `props.h` — optional width/height override (auto-detected if omitted)

Response includes `assetPaths` mapping original filenames to served URLs:

```json
{
  "boardId": "...",
  "createdIds": ["shape:abc123"],
  "assetPaths": { "screenshot.png": "/api/boards/<id>/assets/screenshot.png" }
}
```

Images are stored at `~/.agent-canvas/boards/<boardId>/assets/`. Duplicate filenames are auto-deduplicated (e.g. `screenshot-1.png`).

### HTML Artifacts

Render arbitrary HTML in a sandboxed iframe. Use for interactive prototypes, visualizations, diagrams with embedded JS, or any rich visual content beyond plain markdown.

```bash
agent-canvas shapes create --board <board-id> --shapes '[
  {"type": "html", "x": 100, "y": 100, "props": {"name": "My Widget", "html": "<h1>Hello</h1><p>Interactive content here</p>"}}
]'
```

HTML props:

- `name` — display name shown in the shape header
- `html` — raw HTML string rendered via iframe `srcdoc`
- `filePath` — absolute path to a local `.html` file (reads content server-side, like markdown's `filePath`)
- `w`, `h` — optional width/height (default 600×400)

Use either `html` (inline content) or `filePath` (read from disk) — if `filePath` is provided and `html` is not, the server reads the file. The name auto-derives from the filename if not specified.

The iframe runs with `sandbox="allow-scripts"` — scripts execute but cannot access the parent page or navigate away. Double-click the shape to interact with the iframe content.

From a file:

```bash
agent-canvas shapes create --board <board-id> --shapes '[
  {"type": "html", "x": 100, "y": 100, "props": {"filePath": "/path/to/dashboard.html"}}
]'
```

Inline HTML:

```bash
agent-canvas shapes create --board <board-id> --shapes '[
  {"type": "html", "x": 100, "y": 100, "props": {"name": "Counter", "html": "<div style=\"text-align:center;padding:20px;font-family:sans-serif\"><h2 id=\"count\">0</h2><button onclick=\"document.getElementById('"'"'count'"'"').textContent=++window.n\">+1</button><script>window.n=0<\/script></div>"}}
]'
```

### Code Diff (Small-Hunk Code Reviews)

Use `code-diff` shapes to compare focused code snippets. This is the preferred shape for PR review because it supports old/new content side by side with syntax highlighting (based on file extension).

```bash
agent-canvas shapes create --board <board-id> --shapes '[
  {
    "type": "code-diff",
    "x": 100,
    "y": 100,
    "props": {
      "w": 560,
      "h": 300,
      "oldFile": {
        "name": "apps/web/src/tldraw-config/markdown-overrides.ts",
        "contents": "label: \"tool.markdown\" as \"tool.select\","
      },
      "newFile": {
        "name": "apps/web/src/tldraw-config/markdown-overrides.ts",
        "contents": "label: \"tool.markdown\","
      }
    }
  }
]'
```

Code diff props:

- `w`, `h` — optional width/height (default 600×400)
- `oldFile.name`, `newFile.name` — file path with extension (for language detection)
- `oldFile.contents`, `newFile.contents` — snippet text to compare

#### New File / Added-Hunk Convention

When the PR adds a new file (or a snippet that has no old-side content), use the same file path on both sides and keep old contents empty:

```json
{
  "type": "code-diff",
  "props": {
    "oldFile": {
      "name": "apps/web/src/tldraw-shapes/code-diff/code-diff-shape-util.tsx",
      "contents": ""
    },
    "newFile": {
      "name": "apps/web/src/tldraw-shapes/code-diff/code-diff-shape-util.tsx",
      "contents": "export class CodeDiffShapeUtil extends BaseBoxShapeUtil<CodeDiffShape> { ... }"
    }
  }
}
```

Do not add placeholder comments like `"// file did not exist on main"` in `oldFile.contents`.

## AI Elements Shapes (CLI)

These shapes are optimized for agent-run workflows where the board becomes a live ops timeline.

### Shape Types

- `file-tree` — workspace/file context for investigations and change scope
- `schema-display` — API contracts and payload expectations
- `snippet` — exact command or one-line code snippets
- `stack-trace` — parsed error stacks with clickable frame display
- `ai-terminal` — terminal/log transcript card
- `test-results` — summarized + grouped test outcomes
- `web-preview` — embedded preview URL with console log panel

### Minimal Props By Shape

Use these minimal payloads when creating one shape at a time:

- `file-tree`: `entries` (array of `{ path, type }`)
- `schema-display`: `method`, `path` (plus `parameters` / `requestFields` / `responseFields` for useful output)
- `snippet`: `code` (`language` optional, defaults apply)
- `stack-trace`: `trace`
- `ai-terminal`: `output`
- `test-results`: `summary` + `tests`
- `web-preview`: `url` (`logs` optional)

Common formatting rules:

- Use escaped `\\n` for line breaks in `trace` / `output`.
- For frame nesting, set `parentId` on child shapes (or use a frame `tempId` in the same create payload).

### Quick Multi-Shape Example

```bash
agent-canvas shapes create --board <board-id> --shapes '[
  {
    "type": "file-tree",
    "x": 80,
    "y": 80,
    "props": {
      "name": "Touched Files",
      "entries": [
        {"path":"apps/web/src/lib/sentry.ts","type":"file"},
        {"path":"apps/web/src/lib/vercel.ts","type":"file"},
        {"path":"tests/e2e/deploy.spec.ts","type":"file"}
      ],
      "selectedPath": "apps/web/src/lib/vercel.ts"
    }
  },
  {
    "type": "stack-trace",
    "x": 80,
    "y": 460,
    "props": {
      "name": "Runtime Error",
      "trace": "TypeError: Cannot read properties of undefined (reading 'deployment')\\n    at createDeployment (apps/web/src/lib/vercel.ts:42:17)\\n    at runDeployFlow (apps/web/src/lib/deploy-flow.ts:88:9)",
      "showInternalFrames": false
    }
  },
  {
    "type": "ai-terminal",
    "x": 760,
    "y": 460,
    "props": {
      "name": "Deploy Logs",
      "output": "[10:14:23] sentry releases propose-version\\n[10:14:24] vercel deploy --prebuilt\\n[10:14:33] Preview: https://acme-git-fix.vercel.app",
      "isStreaming": false,
      "autoScroll": true
    }
  },
  {
    "type": "test-results",
    "x": 80,
    "y": 900,
    "props": {
      "name": "CI Validation",
      "summary": {"passed":8,"failed":1,"skipped":1,"total":10,"duration":15420},
      "tests": [
        {"suite":"deploy-flow","name":"creates preview deployment","status":"passed","duration":840},
        {"suite":"deploy-flow","name":"streams build logs","status":"passed","duration":1020},
        {"suite":"deploy-flow","name":"captures stack trace on build failure","status":"failed","duration":1340,"errorMessage":"Expected error breadcrumb count to be > 0","errorStack":"at tests/e2e/deploy.spec.ts:182:13"}
      ]
    }
  },
  {
    "type": "web-preview",
    "x": 760,
    "y": 900,
    "props": {
      "name": "Preview App",
      "url": "https://acme-git-fix.vercel.app",
      "logs": [
        {"level":"log","message":"App booted successfully","timestamp":"2026-02-15T10:15:03.000Z"},
        {"level":"warn","message":"Feature flag fallback active","timestamp":"2026-02-15T10:15:07.000Z"}
      ]
    }
  }
]'
```

### Schema + Snippet Example

```bash
agent-canvas shapes create --board <board-id> --shapes '[
  {
    "type": "schema-display",
    "x": 100,
    "y": 100,
    "props": {
      "method": "POST",
      "path": "/api/deployments",
      "description": "Create a deployment and stream status updates.",
      "parameters": [
        {"name":"projectId","type":"string","required":true,"location":"path","description":"Vercel project id"}
      ],
      "requestFields": [
        {"name":"commitSha","type":"string","required":true,"description":"Git SHA"},
        {"name":"environment","type":"string","required":true,"description":"preview|production"}
      ],
      "responseFields": [
        {"name":"deploymentId","type":"string","required":true,"description":"Created deployment id"},
        {"name":"url","type":"string","required":true,"description":"Deployed URL"}
      ]
    }
  },
  {
    "type": "snippet",
    "x": 100,
    "y": 560,
    "props": {
      "prefix": "$",
      "language": "bash",
      "code": "vercel deploy --prebuilt --scope team-acme"
    }
  }
]'
```

## Real-World Agent Canvas Playbooks

Use these patterns for high-signal, demo-friendly workflows where the board shows the full lifecycle of agent work.

### 1) Sentry-to-Fix-to-Deploy Loop

1. Pull issue context from Sentry MCP.
2. Add `stack-trace` for the exact runtime failure.
3. Add `file-tree` for suspected touchpoints.
4. Add focused `code-diff` hunks for the fix.
5. Stream release/deploy output into `ai-terminal`.
6. Add `web-preview` of the fresh deployment.
7. Add `test-results` from CI/targeted suites.
8. Add a `markdown` shape summarizing root cause and final status.

### 2) Vercel Preview Verification Board

1. Use CLI/MCP to create a preview deployment.
2. Show deployment command in `snippet`.
3. Show deployment API contract in `schema-display`.
4. Add `ai-terminal` snapshots at key milestones.
6. Capture UI screenshots with `agent-canvas screenshot` and place as `image` shapes.
7. Connect all evidence with `arrow` shapes to tell the story.

### 3) Incident Timeline (Ops Whiteboard)

1. Use one `markdown` shape per phase: detect, mitigate, validate, close.
2. Attach `stack-trace` + `ai-terminal` under each phase.
3. Add `web-preview` or `html` shape for reproducer dashboards.
4. Add `test-results` after each mitigation attempt.
5. Keep a final markdown summary with unresolved follow-ups.

### 4) Multi-Agent Hackathon Demo Flow

1. Agent A investigates (`file-tree`, `stack-trace`).
2. Agent B patches (`code-diff`, `snippet` commands).
3. Agent C deploys (`ai-terminal`, `web-preview`).
4. Agent D validates (`test-results`, screenshots as `image`).
5. Merge all outputs into one narrative with `markdown` summaries.

This makes the board a replayable proof of work, not just a static diagram.

## PR Review Workflow (Logical Groups + Small Hunks)

Use this workflow for richer code reviews on the whiteboard.

1. Diff against `main` and identify logical pieces of work (not file-by-file dumps).
2. For each logical group, create a short heading text shape.
3. Add multiple small `code-diff` shapes per group, each scoped to a focused hunk (for example 5-40 lines).
4. It is expected to have multiple shapes from the same file in one group if they represent different concerns.
5. Add targeted context snippets from untouched files when needed to explain behavior.
6. Connect related snippets with arrow shapes and short rationale labels.
7. Add shapes in small batches (a few at a time), then inspect and reposition to avoid overlap.
8. Keep filenames in `oldFile.name/newFile.name` as real paths with extensions (`.ts`, `.tsx`, etc.) for proper rendering.
9. Deduplicate visually redundant snippets and avoid exact duplicate payloads.

### Rich Review Add-ons (Screenshots + Diagrams)

Use screenshots and architecture diagrams to improve review comprehension.

- Capture relevant UI snapshots with `agent-browser` (or equivalent), using pan/zoom controls to frame the right area.
- Add screenshots as `image` shapes and place them near the matching logical group.
- Add arrows from group headings/snippets to each screenshot to make relevance explicit.
- Add architecture diagrams and sequence diagrams as shape compositions (for example `geo` + `arrow` + `text`) and place them near the relevant review group or as a board-level summary.

## Updating Shapes

Update existing shapes by passing an array of update objects. Each update object requires `id` (the real TLDraw shape ID from a create response or `shapes get`) and `type`. All other fields are optional — only the fields you provide are updated.

```bash
agent-canvas shapes update --board <board-id> --shapes '[{"id": "shape:abc", "type": "geo", "props": {"color": "red"}}]'
```

You can update position (`x`, `y`), any props, or both. The `text` prop is auto-converted to `richText` just like in create.

### Examples

Change color:

```bash
agent-canvas shapes update --board <board-id> --shapes '[{"id": "shape:abc", "type": "geo", "props": {"color": "red"}}]'
```

Move a shape:

```bash
agent-canvas shapes update --board <board-id> --shapes '[{"id": "shape:abc", "type": "geo", "x": 500, "y": 200}]'
```

Update text:

```bash
agent-canvas shapes update --board <board-id> --shapes '[{"id": "shape:abc", "type": "note", "props": {"text": "New text"}}]'
```

Multiple updates in one call:

```bash
agent-canvas shapes update --board <board-id> --shapes '[
  {"id": "shape:abc", "type": "geo", "props": {"color": "red", "fill": "solid"}},
  {"id": "shape:def", "type": "text", "x": 300, "y": 400}
]'
```

## Deleting Shapes

Delete shapes by passing a JSON array of real TLDraw shape IDs.

```bash
agent-canvas shapes delete --board <board-id> --ids '["shape:abc", "shape:def"]'
```

- Pass real TLDraw shape IDs (from a create response `createdIds`/`idMap`, or from `shapes get`)
- Arrow bindings are automatically cleaned up when connected shapes are deleted
- Deletion is immediate and irreversible on the canvas

## Workflow Pattern

1. Create a board or list existing boards to get a board ID
2. Create shapes in batches using `tempId` for cross-referencing
3. Use `idMap` from the response to reference shapes in subsequent calls
4. Read shapes with `shapes get` to inspect current state (use `--full --json` when you need complete payloads)
5. Update shapes with `shapes update` to change position, props, or text
6. Capture screenshots of selected shapes with `screenshot` when needed
7. Delete shapes with `shapes delete` when they are no longer needed
