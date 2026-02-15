import { FullScreenIcon, ViewSidebarRightIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { renderMermaid } from "beautiful-mermaid";
import DOMPurify from "dompurify";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

// Module-level SVG cache (keyed by code + theme fingerprint)
const svgCache = new Map<string, string>();

/** Read a resolved CSS color from the document root. */
function getCssColor(varName: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
}

/** Build a theme fingerprint so cached SVGs invalidate on theme change. */
function getThemeFingerprint(): string {
  return getCssColor("--foreground") + getCssColor("--background");
}

/** Resolve our design-token palette into hex strings for beautiful-mermaid. */
function resolveThemeColors() {
  // Use a temporary canvas to convert oklch → hex
  const ctx = document.createElement("canvas").getContext("2d")!;
  const resolve = (varName: string): string => {
    ctx.fillStyle = getCssColor(varName);
    return ctx.fillStyle; // returns resolved hex
  };

  return {
    bg: resolve("--background"),
    fg: resolve("--foreground"),
    muted: resolve("--muted-foreground"),
    line: resolve("--muted-foreground"),
    border: resolve("--border"),
    surface: resolve("--muted"),
    accent: resolve("--foreground"),
  };
}

interface MermaidBlockProps {
  code: string;
  id: string;
  onPinToPanel?: (id: string) => void;
  /** Constrain height (default true). Set false in side panel for full height. */
  compact?: boolean;
}

export function MermaidBlock({ code, id, onPinToPanel, compact = true }: MermaidBlockProps) {
  const cacheKey = `${getThemeFingerprint()}::${code}`;
  const [svg, setSvg] = useState<string | null>(svgCache.get(cacheKey) ?? null);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [prevCacheKey, setPrevCacheKey] = useState(cacheKey);

  // Sync from cache when cacheKey changes (e.g. theme switch)
  if (cacheKey !== prevCacheKey) {
    setPrevCacheKey(cacheKey);
    const cached = svgCache.get(cacheKey);
    setSvg(cached ?? null);
  }

  useEffect(() => {
    if (svgCache.has(cacheKey)) return;

    let cancelled = false;
    const colors = resolveThemeColors();

    renderMermaid(code, {
      ...colors,
      transparent: true,
      font: "Geist Variable, sans-serif",
    })
      .then((result) => {
        if (cancelled) return;
        const sanitized = DOMPurify.sanitize(result, {
          USE_PROFILES: { svg: true, svgFilters: true },
        });
        svgCache.set(cacheKey, sanitized);
        setSvg(sanitized);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to render diagram");
      });

    return () => {
      cancelled = true;
    };
  }, [code, cacheKey]);

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
      <div className="overflow-hidden rounded-md border border-border bg-card">
        <div className="relative group">
          <div
            className={`overflow-auto p-2 [&_svg]:w-full [&_svg]:h-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-track]:my-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20 ${compact ? "max-h-80" : ""}`}
          >
            <div
              // biome-ignore lint/security/noDangerouslySetInnerHtml: SVG sanitized by DOMPurify
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          </div>
          <div className="absolute top-2 right-5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {onPinToPanel && (
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => onPinToPanel(id)}
                title="Pin to side panel"
                className="bg-background/80"
              >
                <HugeiconsIcon icon={ViewSidebarRightIcon} className="size-3.5" strokeWidth={2} />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setDialogOpen(true)}
              title="View full size"
              className="bg-background/80"
            >
              <HugeiconsIcon icon={FullScreenIcon} className="size-3.5" strokeWidth={2} />
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-fit max-w-[calc(100vw-4rem)] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Diagram</DialogTitle>
          </DialogHeader>
          <div
            className="flex-1 overflow-auto [&_svg]:max-w-[calc(100vw-6rem)] [&_svg]:max-h-[80vh] [&_svg]:w-auto [&_svg]:h-auto"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: SVG sanitized by DOMPurify
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
