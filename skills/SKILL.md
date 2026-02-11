---
name: agent-canvas
description: Draw shapes, arrows, and diagrams on a TLDraw canvas via the agent-canvas CLI. Use when an agent needs to visually communicate ideas, create diagrams, flowcharts, or annotate a whiteboard. Triggers on tasks involving drawing, diagramming, visual explanations, or canvas manipulation.
user-invocable: true
---

# Agent Canvas

Agent Canvas lets you create and manipulate shapes on a TLDraw whiteboard from the CLI. The browser must have the board open for shape operations to work (WebSocket relay).

## Prerequisites

1. Server must be running: `agent-canvas open` or `bun run dev`
2. Board must be open in a browser tab

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

## Text in Shapes (richText)

TLDraw v4 uses `richText` (not `text`) for all shape text content. The format is a ProseMirror doc:

```json
{"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Your text"}]}]}
```

Use `richText` in `props` for `geo`, `text`, and `note` shapes.

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
  {"type": "geo", "x": 100, "y": 100, "props": {"w": 200, "h": 100, "geo": "rectangle", "richText": {"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Hello"}]}]}, "align": "middle", "verticalAlign": "middle"}}
]'
```

Supported `geo` values: `rectangle`, `ellipse`, `diamond`, `triangle`, `pentagon`, `hexagon`, `octagon`, `star`, `cloud`, `arrow-right`, `arrow-left`, `arrow-up`, `arrow-down`, `x-box`, `check-box`.

Optional styling props: `color` (`black`, `red`, `green`, `blue`, etc.), `fill` (`none`, `solid`, `semi`, `pattern`), `size` (`s`, `m`, `l`, `xl`), `dash` (`draw`, `solid`, `dashed`, `dotted`).

### Text

```bash
agent-canvas shapes create --board <board-id> --shapes '[
  {"type": "text", "x": 100, "y": 300, "props": {"richText": {"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Hello World"}]}]}, "size": "m"}}
]'
```

Size options: `s`, `m`, `l`, `xl`.

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
  "idMap": {"box-a": "shape:abc123", "box-b": "shape:def456"}
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
  {"tempId": "start", "type": "geo", "x": 300, "y": 50, "props": {"w": 200, "h": 80, "geo": "ellipse", "richText": {"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Start"}]}]}, "align": "middle", "verticalAlign": "middle"}},
  {"tempId": "process", "type": "geo", "x": 300, "y": 250, "props": {"w": 200, "h": 80, "geo": "rectangle", "richText": {"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Process"}]}]}, "align": "middle", "verticalAlign": "middle"}},
  {"tempId": "decision", "type": "geo", "x": 300, "y": 450, "props": {"w": 200, "h": 100, "geo": "diamond", "richText": {"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Condition?"}]}]}, "align": "middle", "verticalAlign": "middle"}},
  {"tempId": "end-yes", "type": "geo", "x": 100, "y": 650, "props": {"w": 160, "h": 80, "geo": "ellipse", "richText": {"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Yes"}]}]}, "align": "middle", "verticalAlign": "middle", "color": "green", "fill": "solid"}},
  {"tempId": "end-no", "type": "geo", "x": 500, "y": 650, "props": {"w": 160, "h": 80, "geo": "ellipse", "richText": {"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"No"}]}]}, "align": "middle", "verticalAlign": "middle", "color": "red", "fill": "solid"}},
  {"tempId": "a1", "type": "arrow", "fromId": "start", "toId": "process", "x1": 400, "y1": 130, "x2": 400, "y2": 250},
  {"tempId": "a2", "type": "arrow", "fromId": "process", "toId": "decision", "x1": 400, "y1": 330, "x2": 400, "y2": 450},
  {"tempId": "a3", "type": "arrow", "fromId": "decision", "toId": "end-yes", "x1": 300, "y1": 500, "x2": 180, "y2": 650},
  {"tempId": "a4", "type": "arrow", "fromId": "decision", "toId": "end-no", "x1": 500, "y1": 500, "x2": 580, "y2": 650}
]'
```

## Workflow Pattern

1. Create a board or list existing boards to get a board ID
2. Create shapes in batches using `tempId` for cross-referencing
3. Use `idMap` from the response to reference shapes in subsequent calls
4. Read shapes with `shapes get` to inspect current state
