import { Markdown as MarkdownIcon } from "@react-symbols/icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Group, Panel, Separator } from "react-resizable-panels";
import { Button } from "@/components/ui/button";
import { parseMarkdown } from "@/lib/parse-markdown";
import { DiagramsPanel } from "./diagrams-panel";
import { MarkdownPanel } from "./markdown-panel";

interface MarkdownViewerProps {
  name: string;
  markdown: string;
  width: number;
  height: number;
  isEditing: boolean;
}

export function MarkdownViewer({ name, markdown, width, height, isEditing }: MarkdownViewerProps) {
  const parsed = useMemo(() => parseMarkdown(markdown), [markdown]);

  const [pinnedDiagramIds, setPinnedDiagramIds] = useState<string[]>([]);
  const [showSidePanel, setShowSidePanel] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handlePinDiagram = useCallback((id: string) => {
    setPinnedDiagramIds((prev) => {
      if (prev.includes(id)) return prev;
      return [...prev, id];
    });
    setShowSidePanel(true);
  }, []);

  const handleUnpinDiagram = useCallback((id: string) => {
    setPinnedDiagramIds((prev) => {
      const next = prev.filter((pid) => pid !== id);
      if (next.length === 0) {
        setShowSidePanel(false);
      }
      return next;
    });
  }, []);

  const handleFullscreen = useCallback(() => {
    setIsFullscreen(true);
  }, []);

  // Escape key to exit fullscreen
  useEffect(() => {
    if (!isFullscreen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setIsFullscreen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [isFullscreen]);

  const hasPinnedDiagrams = pinnedDiagramIds.length > 0;
  const showPanel = showSidePanel && hasPinnedDiagrams;

  const borderClass = isEditing ? "border border-chart-1" : "border border-border";

  const markdownPanel = (
    <MarkdownPanel
      markdown={markdown}
      parsed={parsed}
      mermaidBlocks={parsed.mermaidBlocks}
      onPinDiagram={handlePinDiagram}
    />
  );

  const sidePanelContent = showPanel && (
    <>
      <Separator className="w-px bg-border hover:bg-chart-1 transition-colors" />
      <Panel defaultSize={30} minSize={15}>
        <div className="flex h-full flex-col overflow-hidden">
          <DiagramsPanel
            pinnedIds={pinnedDiagramIds}
            allBlocks={parsed.mermaidBlocks}
            onUnpin={handleUnpinDiagram}
          />
        </div>
      </Panel>
    </>
  );

  const panelLayout = (
    <Group orientation="horizontal" className="flex-1">
      <Panel defaultSize={showPanel ? 70 : 100} minSize={30}>
        {markdownPanel}
      </Panel>
      {sidePanelContent}
    </Group>
  );

  const sidePanelToggleButton = hasPinnedDiagrams && (
    <Button
      variant="ghost"
      size="icon-xs"
      title={showSidePanel ? "Hide side panel" : "Show side panel"}
      onClick={() => setShowSidePanel((v) => !v)}
      className={showSidePanel ? "bg-accent text-foreground" : "text-muted-foreground"}
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
        <rect x="2" y="2" width="12" height="12" rx="1" />
        <line x1="10" y1="2" x2="10" y2="14" />
      </svg>
    </Button>
  );

  // Fullscreen portal overlay
  if (isFullscreen) {
    return (
      <>
        <div style={{ width, height }} />
        {createPortal(
          <div
            className="fixed inset-0 z-9999 flex flex-col bg-background select-text cursor-auto"
            style={{ pointerEvents: "all" }}
          >
            <div className="flex items-center justify-between border-b border-border bg-muted/50 px-4 py-2 shrink-0">
              <span className="text-sm font-medium text-foreground truncate">
                {name || "Markdown"}
              </span>
              <div className="flex items-center gap-1">
                {sidePanelToggleButton}
                <Button
                  variant="ghost"
                  size="icon-xs"
                  title="Exit fullscreen"
                  onClick={() => setIsFullscreen(false)}
                  className="text-muted-foreground"
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
                    <line x1="4" y1="4" x2="12" y2="12" />
                    <line x1="12" y1="4" x2="4" y2="12" />
                  </svg>
                </Button>
              </div>
            </div>
            {panelLayout}
          </div>,
          document.body,
        )}
      </>
    );
  }

  const header = (
    <div className="flex items-center justify-between border-b border-border bg-muted/50 px-3 py-1.5 shrink-0">
      <div className="flex items-center gap-1.5 truncate">
        <MarkdownIcon className="size-5 shrink-0" />
        <span className="text-sm font-medium text-foreground truncate">{name || "Markdown"}</span>
      </div>
      <div className="flex items-center gap-1">
        {isEditing && <span className="inline-flex size-2 shrink-0 rounded-full bg-chart-1" />}
        {sidePanelToggleButton}
        <Button
          variant="ghost"
          size="icon-xs"
          title="Fullscreen"
          onClick={handleFullscreen}
          className="text-muted-foreground"
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
  );

  const editOverlay = !isEditing && (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/0 opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
      <span className="rounded-md bg-foreground/80 px-3 py-1.5 text-xs font-medium text-background shadow-sm">
        Double-click to interact
      </span>
    </div>
  );

  return (
    <div
      className={`relative flex h-full flex-col overflow-hidden rounded-lg ${borderClass} bg-card shadow-sm ${isEditing ? "select-text cursor-auto" : ""}`}
      style={{ width, height }}
    >
      {editOverlay}
      {header}
      {panelLayout}
    </div>
  );
}
