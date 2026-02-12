# Visual Markdown Feature — Code Review

Comprehensive review of the `visual-markdown` feature covering React performance, TypeScript quality, security, and architecture.

---

## Summary

| Severity     | Count | Key Issues |
|--------------|-------|------------|
| **Critical** | 1     | Non-deterministic module-level `idCounter` in parser |
| **High**     | 3     | Unbounded SVG cache, XSS via `dangerouslySetInnerHTML`, path traversal gaps in `/api/files` |
| **Medium**   | 5     | `components` object not memoized, `sectionMap` timing, plugin arrays recreated, heavy bundle not lazy-loaded, fragile mermaid counter |
| **Low**      | 7     | DRY violations (SVG icons), unused props, redundant props, type assertions, hardcoded theme, component size, regex not hoisted |

---

## Critical

### 1. Non-deterministic module-level `idCounter`

**File:** `lib/parse-markdown.ts:3-6`

```ts
let idCounter = 0;
function nextId(prefix: string): string {
  return `${prefix}-${++idCounter}`;
}
```

**Problem:** `idCounter` increments globally and never resets. Each call to `parseMarkdown()` produces different IDs for the same content:

```
First call:  mermaid-1, mermaid-2
Second call: mermaid-3, mermaid-4  // same markdown, different IDs!
```

This causes cascading failures:
- `svgCache` in `mermaid-block.tsx` (keyed by `id`) accumulates stale entries that never match again — **unbounded memory leak**
- `pinnedDiagramIds` state in `visual-markdown-viewer.tsx` breaks when IDs change after re-parse
- React Strict Mode double-invocation produces mismatched IDs

**Fix:** Use index-based IDs scoped to each `parseMarkdown` call:

```ts
export function parseMarkdown(raw: string): ParsedMarkdown {
  let mermaidIndex = 0;
  let sectionIndex = 0;
  // ...
  const block: MermaidBlock = {
    id: `mermaid-${mermaidIndex++}`,
    code,
    sectionId,
  };
  // ...
}
```

---

## High

### 2. Unbounded `svgCache` with unstable keys

**File:** `components/mermaid-block.tsx:13`

```ts
const svgCache = new Map<string, string>();
```

**Problem:** Combined with issue #1, every re-parse creates new IDs, so the same diagram gets cached under a new key each time. The old entries are never evicted. SVG strings can be 10-50KB each.

**Fix:** Key cache by `code` content instead of `id`, and consider adding a max size:

```ts
// Key by code content for stability
const svgCache = new Map<string, string>();

// In effect:
if (svgCache.has(code)) {
  setSvg(svgCache.get(code)!);
  return;
}
// ...
svgCache.set(code, result);
```

### 3. XSS via `dangerouslySetInnerHTML`

**File:** `components/mermaid-block.tsx:70, 128`

```tsx
<div dangerouslySetInnerHTML={{ __html: svg }} />
```

**Problem:** SVG from `renderMermaid()` is injected directly. Mermaid diagrams come from markdown authored by AI agents or external sources. Mermaid's rendering can embed `<foreignObject>`, `<script>`, or event handler attributes in SVGs.

**Fix:** Sanitize before injection:

```ts
import DOMPurify from 'dompurify';

const sanitized = DOMPurify.sanitize(result, { USE_PROFILES: { svg: true } });
svgCache.set(code, sanitized);
setSvg(sanitized);
```

### 4. Path traversal gaps in `/api/files`

**File:** `packages/server/src/app.ts:36-42`

```ts
const cwd = process.cwd();
const resolved = resolve(cwd, path);
const rel = relative(cwd, resolved);
if (rel.startsWith("..") || resolve(resolved) !== resolved.replace(/\/$/, "")) {
  return c.json({ error: "Invalid path" }, 400);
}
```

**Problems:**
1. The second condition (`resolve(resolved) !== resolved.replace(...)`) is a **no-op** — `resolve()` is idempotent on absolute paths
2. **Symlinks** within CWD can point outside it; `relative()` doesn't resolve symlinks but `Bun.file()` follows them
3. No deny-list for sensitive files (`.env`, `.git/config`, `secrets.json`)
4. No file size limit — large files could cause memory pressure
5. `parseInt` on `startLine`/`endLine` (lines 56-57) returns `NaN` for non-numeric input without error

**Fix:**

```ts
import { realpath } from "node:fs/promises";

const realResolved = await realpath(resolved);
if (!realResolved.startsWith(cwd + "/")) {
  return c.json({ error: "Invalid path" }, 400);
}

// Deny sensitive files
const DENIED = [".env", ".git/", "secrets"];
if (DENIED.some((d) => rel.includes(d))) {
  return c.json({ error: "Access denied" }, 403);
}
```

---

## Medium

### 5. `components` object recreated every render

**File:** `components/markdown-panel.tsx:38-139`

```tsx
const components: Components = {
  h1: ({ children, ...props }) => renderHeading("h1", ...),
  h2: ({ children, ...props }) => renderHeading("h2", ...),
  // ... 100 lines of component definitions
} as Components;
```

**Problem:** New object reference every render forces `ReactMarkdown` to re-render its entire tree. This is the most expensive prop in the render path.

**Fix:** Wrap in `useMemo`:

```tsx
const components = useMemo<Components>(() => ({
  h1: ({ children, ...props }) => renderHeading("h1", ...),
  // ...
}), [parsed, mermaidBlocks, onPinDiagram]);
```

### 6. `sectionMap` populated via effect — stale on first render

**File:** `components/markdown-panel.tsx:30-36`

```tsx
const sectionMap = useRef(new Map<string, string>());
useEffect(() => {
  sectionMap.current.clear();
  for (const section of parsed.sections) {
    sectionMap.current.set(section.title, section.id);
  }
}, [parsed]);
```

**Problem:** `useEffect` fires *after* render commit. On the first render (and any render where `parsed` changes), heading components read `sectionMap.current` which still contains the **previous** value. Headings will lack their `data-section-id` until the next render.

```
┌─────────────────────────────────────────────────────┐
│  Timeline                                           │
│                                                     │
│  1. parsed changes ──► new sectionMap needed        │
│  2. render runs    ──► headings read OLD sectionMap │
│  3. commit to DOM  ──► headings rendered wrong      │
│  4. useEffect runs ──► sectionMap updated (too late)│
│  5. (no re-render triggered)                        │
└─────────────────────────────────────────────────────┘
```

**Fix:** Use `useMemo` for synchronous computation:

```tsx
const sectionMap = useMemo(() => {
  const map = new Map<string, string>();
  for (const section of parsed.sections) {
    map.set(section.title, section.id);
  }
  return map;
}, [parsed]);
```

### 7. Plugin arrays recreated every render

**File:** `components/markdown-panel.tsx:145-146`

```tsx
<ReactMarkdown
  remarkPlugins={[remarkGfm, remarkMath]}   // new array ref
  rehypePlugins={[rehypeKatex]}              // new array ref
>
```

**Fix:** Hoist to module scope:

```ts
const REMARK_PLUGINS = [remarkGfm, remarkMath];
const REHYPE_PLUGINS = [rehypeKatex];
```

### 8. Heavy libraries not lazy-loaded

**File:** `components/markdown-panel.tsx:2-8` (imported transitively via shape util)

`react-markdown`, `remark-gfm`, `remark-math`, `rehype-katex`, and `beautiful-mermaid` are all statically imported. These are heavy libraries bundled even when no visual-markdown shapes exist on the canvas.

**Fix:** Lazy-load `VisualMarkdownViewer` in the shape util:

```tsx
const VisualMarkdownViewer = React.lazy(
  () => import('./components/visual-markdown-viewer')
    .then(m => ({ default: m.VisualMarkdownViewer }))
);

// In component():
<Suspense fallback={<Skeleton />}>
  <VisualMarkdownViewer ... />
</Suspense>
```

### 9. Fragile mermaid counter reset during render

**File:** `components/markdown-panel.tsx:24-27`

```tsx
const mermaidCounterRef = useRef(0);
mermaidCounterRef.current = 0; // reset during render phase

// Later, in the `code` component:
const index = mermaidCounterRef.current++;
const block = mermaidBlocks[index];
```

**Problem:** This couples `ReactMarkdown`'s code-block rendering order to the positional order from `parseMarkdown`. If `ReactMarkdown` ever renders lazily, skips blocks, or changes order, the counter goes out of sync. Fragile under React Strict Mode double-render in development.

**Fix:** Match by content instead of position:

```tsx
const mermaidBlockMap = useMemo(
  () => new Map(mermaidBlocks.map((b) => [b.code, b])),
  [mermaidBlocks]
);

// In code component:
if (lang === "mermaid") {
  const code = String(children).trim();
  const block = mermaidBlockMap.get(code);
  if (!block) return null;
  return <MermaidBlockComponent id={block.id} code={block.code} ... />;
}
```

---

## Low

### 10. Repeated inline SVG icons (DRY violation)

The same SVG icons are duplicated across 3 files:

| Icon | Locations |
|------|-----------|
| Side panel (`rect` + `line`) | `visual-markdown-viewer.tsx:121-133`, `mermaid-block.tsx:80-92` |
| Close (two crossing lines) | `visual-markdown-viewer.tsx:160-172`, `diagrams-panel.tsx:94-106` |
| Fullscreen (four corner polylines) | `visual-markdown-viewer.tsx:204-218`, `mermaid-block.tsx:102-116` |
| Chevron | `diagrams-panel.tsx:70-79` |

**Fix:** Extract to shared icon components or a single `icons.tsx` file.

### 11. Unused props: `shapeId` and `editor`

**File:** `visual-markdown-shape-util.tsx:75-76` → `visual-markdown-viewer.tsx:16-17`

`shapeId` and `editor` are declared in `VisualMarkdownViewerProps`, passed through from `VisualMarkdownShapeContent`, but never used inside `VisualMarkdownViewer`. The `VisualMarkdownShapeContent` wrapper exists solely to call `useEditor()` for this unused prop — it can be eliminated entirely.

### 12. Redundant `mermaidBlocks` prop

**File:** `components/markdown-panel.tsx:13`, `visual-markdown-viewer.tsx:84`

```tsx
<MarkdownPanel
  parsed={parsed}                          // contains mermaidBlocks
  mermaidBlocks={parsed.mermaidBlocks}     // redundant
/>
```

`parsed.mermaidBlocks` is always the same as the separately-passed `mermaidBlocks`. Remove the separate prop.

### 13. Unused parameter `_parsed` in `renderHeading`

**File:** `components/markdown-panel.tsx:160`

```ts
function renderHeading(
  Tag: "h1" | "h2" | "h3",
  children: React.ReactNode,
  props: Record<string, unknown>,
  _parsed: ParsedMarkdown,    // never used
  sectionMap: Map<string, string>
)
```

### 14. Type assertions

- `as Components` cast at `markdown-panel.tsx:139` — redundant since the variable is already typed on line 38
- `extractText` at line 189 uses `(node as { props: { children?: React.ReactNode } })` without validation

### 15. Hardcoded mermaid theme colors

**File:** `components/mermaid-block.tsx:35-36`

```ts
renderMermaid(code, {
  bg: "#ffffff",     // always light theme
  fg: "#27272a",     // zinc-800
  transparent: true,
})
```

Diagrams always render with light-theme foreground colors regardless of the app's dark/light mode.

### 16. Regex not hoisted

**File:** `components/markdown-panel.tsx:47`

```tsx
const match = /language-(\w+)/.exec(className ?? "");
```

Created on every `code` component invocation. Hoist to module scope:

```ts
const LANGUAGE_REGEX = /language-(\w+)/;
```

---

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│ VisualMarkdownShapeUtil (shape-util)                             │
│  ├── registers shape with tldraw                                │
│  ├── markEventAsHandled for pointer events (edit mode)          │
│  └── renders VisualMarkdownShapeContent                         │
│       └── useEditor() → passes to VisualMarkdownViewer [UNUSED] │
├──────────────────────────────────────────────────────────────────┤
│ VisualMarkdownViewer (orchestrator)                              │
│  ├── parseMarkdown(markdown) via useMemo                        │
│  ├── pinnedDiagramIds state                                     │
│  ├── fullscreen mode (createPortal)                             │
│  └── Layout:                                                    │
│       ├── Header (title, edit dot, toggle, fullscreen)          │
│       └── Group (react-resizable-panels)                        │
│            ├── Panel: MarkdownPanel                             │
│            ├── Separator                                        │
│            └── Panel: DiagramsPanel (if pinned)                 │
├──────────────────────────────────────────────────────────────────┤
│ MarkdownPanel                                                    │
│  ├── ReactMarkdown with remark-gfm, remark-math, rehype-katex  │
│  ├── Inline MermaidBlock for ```mermaid fences                  │
│  └── sectionMap for heading data attributes                     │
├──────────────────────────────────────────────────────────────────┤
│ DiagramsPanel                                                    │
│  ├── Collapsible accordion for pinned diagrams                  │
│  └── Each entry: MermaidBlock + unpin button                    │
├──────────────────────────────────────────────────────────────────┤
│ MermaidBlock                                                     │
│  ├── renderMermaid() → SVG (module-level cache)                 │
│  ├── Hover buttons: pin + fullscreen                            │
│  └── Dialog for fullscreen view                                 │
├──────────────────────────────────────────────────────────────────┤
│ parseMarkdown (lib)                                              │
│  ├── Extracts sections + mermaid blocks from raw markdown       │
│  └── ⚠️ Non-deterministic module-level idCounter                │
└──────────────────────────────────────────────────────────────────┘
```

---

## Priority Actions

1. **Fix `idCounter`** — switch to index-based IDs scoped per call (Critical, causes cascading bugs)
2. **Re-key `svgCache` by `code`** — fixes memory leak and stale cache hits (High)
3. **Sanitize SVG output** — add DOMPurify before `dangerouslySetInnerHTML` (High)
4. **Harden `/api/files`** — use `realpath`, add deny-list, validate query params (High)
5. **Memoize `components` object** — biggest single render perf win (Medium)
6. **Replace `sectionMap` `useRef+useEffect` with `useMemo`** — fixes stale-render bug (Medium)
