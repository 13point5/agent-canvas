import { Http } from "@react-symbols/icons";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";

interface HtmlViewerProps {
  name: string;
  content: string;
  width: number;
  height: number;
  isEditing: boolean;
}

export function HtmlViewer({ name, content, width, height, isEditing }: HtmlViewerProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

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

  const borderClass = isEditing ? "border border-chart-1" : "border border-border";

  const codeIcon = <Http className="size-5 shrink-0" />;

  const iframe = (
    <iframe
      srcDoc={content}
      sandbox="allow-scripts"
      title={name || "HTML Artifact"}
      className="border-0 bg-white"
      style={{ width: "100%", height: "100%", display: "block" }}
    />
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
              <div className="flex items-center gap-1.5 truncate">
                {codeIcon}
                <span className="text-sm font-medium text-foreground truncate">{name || "HTML Artifact"}</span>
              </div>
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
            <div className="flex-1">{iframe}</div>
          </div>,
          document.body,
        )}
      </>
    );
  }

  const header = (
    <div className="flex items-center justify-between border-b border-border bg-muted/50 px-3 py-1.5 shrink-0">
      <div className="flex items-center gap-1.5 truncate">
        {codeIcon}
        <span className="text-sm font-medium text-foreground truncate">{name || "HTML Artifact"}</span>
      </div>
      <div className="flex items-center gap-1">
        {isEditing && <span className="inline-flex size-2 shrink-0 rounded-full bg-chart-2" />}
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
      <div className="flex-1 overflow-hidden">{iframe}</div>
    </div>
  );
}
