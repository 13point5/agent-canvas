# Markdown Panel Layout

## Overview

A visual markdown rendering mode that displays text, diagrams, and file references together in a multi-panel layout. The goal is to give users a rich, IDE-like reading experience where embedded assets (images, file refs, code snippets) can be surfaced in dedicated side panels alongside the main markdown content.

## Current Approach (WIP)

Three fixed panels:

| Left Panel | Middle Panel | Right Panel |
|---|---|---|
| File references | Markdown body | Diagrams |

Content is automatically parsed and routed to the appropriate panel as the user scrolls through the markdown.

## Proposed Design

### Inline Action Buttons

Rather than auto-routing every asset to a fixed panel, each embedded element (image, file reference, code snippet, diagram) gets a small inline button. Clicking the button adds that element to a split panel of the user's choice. This keeps the author in control of what gets promoted to a panel and what stays inline.

### IDE-Style Panel Management

Once an element is added to a panel, users can:

- Drag and drop panels to rearrange them (left, right, bottom, floating)
- Resize panels by dragging dividers
- Close panels to return elements to their inline position
- Stack multiple elements in the same panel as tabs

### Auto-Scroll Mode (Toggle)

The current auto-parse behavior (panels update dynamically as the user scrolls) is useful for a first read-through but can be disruptive during focused editing or re-reading.

Proposed solution: a toggle that switches between two modes.

- **Dynamic mode (on by default):** As the user scrolls, the side panels automatically update to show the nearest relevant file refs, diagrams, and code snippets. Good for an initial pass through unfamiliar content.
- **Pinned mode:** Panels stop auto-updating. The user manually adds/removes elements via inline buttons and arranges them however they like. Good for deeper work once the user knows what they want visible.

### Workflow

1. User opens a markdown file. Dynamic mode is on.
2. As they scroll, side panels populate with contextually relevant assets.
3. User finds a layout they like, toggles to pinned mode.
4. From pinned mode, they can still use inline buttons to add/remove panel items and drag to rearrange.
