import { useEffect, useState } from "react";
import { renderMermaid } from "beautiful-mermaid";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// Module-level SVG cache
const svgCache = new Map<string, string>();

interface MermaidBlockProps {
  code: string;
  id: string;
  onPinToPanel?: (id: string) => void;
}

export function MermaidBlock({ code, id, onPinToPanel }: MermaidBlockProps) {
  const [svg, setSvg] = useState<string | null>(svgCache.get(code) ?? null);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (svgCache.has(code)) {
      setSvg(svgCache.get(code)!);
      return;
    }

    let cancelled = false;

    renderMermaid(code, {
      bg: "#ffffff",
      fg: "#27272a",
      transparent: true,
      font: "Geist Variable, sans-serif",
    })
      .then((result) => {
        if (cancelled) return;
        svgCache.set(code, result);
        setSvg(result);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to render diagram");
      });

    return () => {
      cancelled = true;
    };
  }, [code, id]);

  if (error) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
        Failed to render diagram: {error}
      </div>
    );
  }

  if (!svg) {
    return <Skeleton className="h-40 w-full rounded-md" />;
  }

  return (
    <>
      <div className="relative group rounded-md border border-border bg-card p-2 [&_svg]:w-full [&_svg]:h-auto">
        <div dangerouslySetInnerHTML={{ __html: svg }} />
        <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onPinToPanel && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => onPinToPanel(id)}
              title="Pin to side panel"
              className="bg-background/80"
            >
              <svg
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
          )}
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setDialogOpen(true)}
            title="View full size"
            className="bg-background/80"
          >
            <svg
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-fit max-w-[calc(100vw-4rem)] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Diagram</DialogTitle>
          </DialogHeader>
          <div
            className="flex-1 overflow-auto [&_svg]:max-w-[calc(100vw-6rem)] [&_svg]:max-h-[80vh] [&_svg]:w-auto [&_svg]:h-auto"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
