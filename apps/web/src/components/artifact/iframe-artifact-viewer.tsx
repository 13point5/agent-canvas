import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";

interface IframeArtifactViewerProps {
  name: string;
  html: string;
  width: number;
  height: number;
  isEditing: boolean;
}

export function IframeArtifactViewer({
  name,
  html,
  width,
  height,
  isEditing,
}: IframeArtifactViewerProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleFullscreen = useCallback(() => {
    setIsFullscreen(true);
  }, []);

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

  const borderClass = isEditing
    ? "border border-chart-1"
    : "border border-border";

  const content = (
    <iframe
      title={name || "Artifact"}
      srcDoc={html}
      sandbox="allow-scripts allow-forms"
      className="h-full w-full border-0 bg-background"
    />
  );

  const header = (
    <div className="flex items-center justify-between border-b border-border bg-muted/50 px-3 py-1.5 shrink-0">
      <span className="text-sm font-medium text-foreground truncate">
        {name || "Artifact"}
      </span>
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
  );

  if (isFullscreen) {
    return (
      <>
        <div style={{ width, height }} />
        {createPortal(
          <div className="fixed inset-0 z-9999 flex flex-col bg-background">
            <div className="flex items-center justify-between border-b border-border bg-muted/50 px-4 py-2 shrink-0">
              <span className="text-sm font-medium text-foreground truncate">
                {name || "Artifact"}
              </span>
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
            <div className="flex-1 overflow-hidden">{content}</div>
          </div>,
          document.body,
        )}
      </>
    );
  }

  return (
    <div
      className={`relative flex h-full flex-col overflow-hidden rounded-lg ${borderClass} bg-card shadow-sm`}
      style={{ width, height }}
    >
      {header}
      <div className="flex-1 overflow-hidden">{content}</div>
    </div>
  );
}
