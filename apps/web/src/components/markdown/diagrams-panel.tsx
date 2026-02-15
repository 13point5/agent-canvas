import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { MermaidBlock } from "@/lib/parse-markdown";

import { MermaidBlock as MermaidBlockComponent } from "./mermaid-block";

interface DiagramsPanelProps {
  pinnedDiagramIds: string[];
  allBlocks: MermaidBlock[];
  pinnedImageSources: string[];
  onUnpinDiagram: (id: string) => void;
  onUnpinImage: (src: string) => void;
}

type PinnedItem =
  | {
      kind: "diagram";
      key: string;
      title: string;
      diagram: MermaidBlock;
    }
  | {
      kind: "image";
      key: string;
      title: string;
      src: string;
    };

export function DiagramsPanel({
  pinnedDiagramIds,
  allBlocks,
  pinnedImageSources,
  onUnpinDiagram,
  onUnpinImage,
}: DiagramsPanelProps) {
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [prevLastPinned, setPrevLastPinned] = useState<string | undefined>();
  const [fullscreenImageSrc, setFullscreenImageSrc] = useState<string | null>(null);
  const [fullscreenImageTitle, setFullscreenImageTitle] = useState<string>("Image");

  const blockMap = new Map(allBlocks.map((block) => [block.id, block]));
  const pinnedDiagramItems = pinnedDiagramIds
    .map((id) => blockMap.get(id))
    .filter((block): block is MermaidBlock => block !== undefined)
    .map<PinnedItem>((diagram, index) => ({
      kind: "diagram",
      key: `diagram:${diagram.id}`,
      title: `Diagram ${index + 1}`,
      diagram,
    }));

  const pinnedImageItems = pinnedImageSources.map<PinnedItem>((src, index) => ({
    kind: "image",
    key: `image:${src}`,
    title: getImageLabel(src, index),
    src,
  }));

  const pinnedItems = [...pinnedDiagramItems, ...pinnedImageItems];
  const lastPinned = pinnedItems[pinnedItems.length - 1]?.key;

  if (lastPinned !== prevLastPinned) {
    setPrevLastPinned(lastPinned);
    if (lastPinned && collapsedIds.has(lastPinned)) {
      const next = new Set(collapsedIds);
      next.delete(lastPinned);
      setCollapsedIds(next);
    }
  }

  if (pinnedItems.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
        <p>No pinned items</p>
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
      {pinnedItems.map((item) => {
        const isCollapsed = collapsedIds.has(item.key);
        const unpinTitle = item.kind === "diagram" ? "Unpin diagram" : "Unpin image";

        return (
          <div key={item.key} className="border-b border-border last:border-b-0">
            <button
              type="button"
              className="flex w-full items-center gap-2 bg-secondary/30 px-3 py-1 transition-colors hover:bg-accent/40 cursor-pointer select-none"
              onClick={() => toggleCollapse(item.key)}
            >
              <svg
                aria-hidden="true"
                className={`h-3 w-3 shrink-0 text-muted-foreground transition-transform ${isCollapsed ? "" : "rotate-90"}`}
                viewBox="0 0 12 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M4 2l4 4-4 4" />
              </svg>
              <span className="truncate text-xs font-medium text-muted-foreground">{item.title}</span>
              <Button
                variant="ghost"
                size="icon-xs"
                className="ml-auto text-muted-foreground"
                title={unpinTitle}
                onClick={(event) => {
                  event.stopPropagation();
                  if (item.kind === "diagram") {
                    onUnpinDiagram(item.diagram.id);
                    return;
                  }
                  onUnpinImage(item.src);
                }}
              >
                <svg
                  aria-hidden="true"
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
            </button>

            {!isCollapsed && (
              <div className="p-3">
                {item.kind === "diagram" ? (
                  <MermaidBlockComponent id={item.diagram.id} code={item.diagram.code} compact={false} />
                ) : (
                  <div className="group relative overflow-hidden rounded-md border border-border bg-card/40">
                    <img src={item.src} alt={item.title} className="block max-h-[340px] w-full object-contain" />
                    <div className="pointer-events-none absolute right-2 top-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        title="View full size"
                        className="pointer-events-auto bg-background/80"
                        onClick={() => {
                          setFullscreenImageSrc(item.src);
                          setFullscreenImageTitle(item.title);
                        }}
                      >
                        <svg
                          aria-hidden="true"
                          width="14"
                          height="14"
                          viewBox="0 0 16 16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="1 5 1 1 5 1" />
                          <polyline points="11 1 15 1 15 5" />
                          <polyline points="15 11 15 15 11 15" />
                          <polyline points="5 15 1 15 1 11" />
                        </svg>
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      <Dialog
        open={fullscreenImageSrc !== null}
        onOpenChange={(open) => {
          if (!open) {
            setFullscreenImageSrc(null);
            setFullscreenImageTitle("Image");
          }
        }}
      >
        <DialogContent className="sm:max-w-fit max-w-[calc(100vw-4rem)] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{fullscreenImageTitle}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            {fullscreenImageSrc && (
              <img
                src={fullscreenImageSrc}
                alt={fullscreenImageTitle}
                className="block h-auto w-auto max-h-[80vh] max-w-[calc(100vw-6rem)] rounded-md border border-border bg-card/40"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function getImageLabel(src: string, index: number): string {
  try {
    const url = new URL(src, window.location.origin);
    const target = url.searchParams.get("target");
    if (target) {
      const normalized = target.split(/[\\/]/).filter(Boolean).pop();
      if (normalized) return normalized;
    }
  } catch {
    // Fallback below.
  }

  const bySlash = src.split(/[\\/]/).filter(Boolean).pop();
  if (bySlash && bySlash !== "content") return bySlash;
  return `Image ${index + 1}`;
}
