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
# Get all shapes from a board
agent-canvas shapes get --board <board-id>
```

### Creating Shapes

Pass a JSON array of shape objects. Each shape follows TLDraw's shape format.

```bash
agent-canvas shapes create --board <board-id> --shapes '<json-array>'
```

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
              "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "First" }] }]
            },
            {
              "type": "listItem",
              "content": [
                { "type": "paragraph", "content": [{ "type": "text", "text": "Second" }] }
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
                { "type": "paragraph", "content": [{ "type": "text", "text": "Step 1" }] }
              ]
            },
            {
              "type": "listItem",
              "content": [
                { "type": "paragraph", "content": [{ "type": "text", "text": "Step 2" }] }
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
          "content": [{ "type": "text", "text": "Section Title", "marks": [{ "type": "bold" }] }]
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
4. Read shapes with `shapes get` to inspect current state
5. Update shapes with `shapes update` to change position, props, or text
6. Delete shapes with `shapes delete` when they are no longer needed
