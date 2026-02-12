import { useState, useEffect } from "react";
import { MermaidBlock as MermaidBlockComponent } from "./mermaid-block";
import type { MermaidBlock } from "../lib/types";
import { Button } from "@/components/ui/button";

interface DiagramsPanelProps {
  pinnedIds: string[];
  allBlocks: MermaidBlock[];
  onUnpin: (id: string) => void;
}

export function DiagramsPanel({
  pinnedIds,
  allBlocks,
  onUnpin,
}: DiagramsPanelProps) {
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  // Auto-expand the most recently pinned (last in array)
  const lastPinned = pinnedIds[pinnedIds.length - 1];
  useEffect(() => {
    if (lastPinned) {
      setCollapsedIds((prev) => {
        if (prev.has(lastPinned)) {
          const next = new Set(prev);
          next.delete(lastPinned);
          return next;
        }
        return prev;
      });
    }
  }, [lastPinned]);

  const blockMap = new Map(allBlocks.map((b) => [b.id, b]));
  const pinnedBlocks = pinnedIds
    .map((id) => blockMap.get(id))
    .filter((b): b is MermaidBlock => b !== undefined);

  if (pinnedBlocks.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
        <p>No pinned diagrams</p>
      </div>
    );
  }

  const toggleCollapse = (id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="h-full overflow-auto">
      {pinnedBlocks.map((block, index) => {
        const isCollapsed = collapsedIds.has(block.id);

        return (
          <div key={block.id} className="border-b border-border last:border-b-0">
            <div
              className="flex items-center gap-2 px-3 py-1 bg-secondary/30 hover:bg-accent/40 transition-colors cursor-pointer select-none"
              onClick={() => toggleCollapse(block.id)}
            >
              <svg
                className={`h-3 w-3 shrink-0 transition-transform text-muted-foreground ${
                  isCollapsed ? "" : "rotate-90"
                }`}
                viewBox="0 0 12 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M4 2l4 4-4 4" />
              </svg>
              <span className="text-xs font-medium text-muted-foreground truncate">
                Diagram {index + 1}
              </span>
              <Button
                variant="ghost"
                size="icon-xs"
                className="ml-auto text-muted-foreground"
                title="Unpin diagram"
                onClick={(e) => {
                  e.stopPropagation();
                  onUnpin(block.id);
                }}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="4" y1="4" x2="12" y2="12" />
                  <line x1="12" y1="4" x2="4" y2="12" />
                </svg>
              </Button>
            </div>

            {!isCollapsed && (
              <div className="p-3">
                <MermaidBlockComponent id={block.id} code={block.code} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
