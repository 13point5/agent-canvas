import { useCallback, useMemo, useState } from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import { useParams } from "react-router-dom";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { MermaidBlock, ParsedMarkdown } from "@/lib/parse-markdown";
import { cn } from "@/lib/utils";

import { MermaidBlock as MermaidBlockComponent } from "./mermaid-block";

const remarkPlugins = [remarkGfm, remarkMath];
const rehypePlugins = [rehypeKatex];

interface MarkdownPanelProps {
  markdown: string;
  filePath?: string;
  parsed: ParsedMarkdown;
  mermaidBlocks: MermaidBlock[];
  onPinDiagram?: (id: string) => void;
  onScrollContainerChange?: (node: HTMLDivElement | null) => void;
  onContentRootChange?: (node: HTMLDivElement | null) => void;
  overlay?: React.ReactNode;
}

export function MarkdownPanel({
  markdown,
  filePath,
  parsed,
  mermaidBlocks,
  onPinDiagram,
  onScrollContainerChange,
  onContentRootChange,
  overlay,
}: MarkdownPanelProps) {
  const { boardId } = useParams<{ boardId: string }>();
  const [blockedReference, setBlockedReference] = useState<{ href: string; reason: string } | null>(null);

  const setScrollRef = useCallback(
    (node: HTMLDivElement | null) => {
      onScrollContainerChange?.(node);
    },
    [onScrollContainerChange],
  );

  const setContentRef = useCallback(
    (node: HTMLDivElement | null) => {
      onContentRootChange?.(node);
    },
    [onContentRootChange],
  );

  const mermaidByCode = useMemo(() => new Map(mermaidBlocks.map((block) => [block.code, block])), [mermaidBlocks]);

  const sectionMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const section of parsed.sections) {
      map.set(section.title, section.id);
    }
    return map;
  }, [parsed]);

  const components: Components = {
    pre: ({ children }) => <>{children}</>,

    h1: ({ children, ...props }) => renderHeading("h1", children, props, sectionMap),
    h2: ({ children, ...props }) => renderHeading("h2", children, props, sectionMap),
    h3: ({ children, ...props }) => renderHeading("h3", children, props, sectionMap),

    p: ({ children, ...props }) => (
      <p className="my-2 leading-7" {...props}>
        {children}
      </p>
    ),

    code: ({ className, children, ...props }) => {
      const match = /language-(\w+)/.exec(className ?? "");
      const lang = match?.[1];

      if (lang === "mermaid") {
        const raw = extractText(children).trim();
        const block = mermaidByCode.get(raw);
        if (!block) return null;
        return <MermaidBlockComponent id={block.id} code={block.code} onPinToPanel={onPinDiagram} />;
      }

      if (!match) {
        return (
          <code className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-sm" {...props}>
            {children}
          </code>
        );
      }

      return (
        <pre className="my-2 overflow-auto rounded-md border border-border bg-muted/30 p-3">
          <code className={`font-mono text-sm ${className ?? ""}`} {...props}>
            {children}
          </code>
        </pre>
      );
    },

    table: ({ children, ...props }) => (
      <div className="my-3 overflow-auto">
        <table className="w-full border-collapse text-sm" {...props}>
          {children}
        </table>
      </div>
    ),
    th: ({ children, ...props }) => (
      <th className="border border-border bg-muted px-3 py-1.5 text-left font-medium" {...props}>
        {children}
      </th>
    ),
    td: ({ children, ...props }) => (
      <td className="border border-border px-3 py-1.5" {...props}>
        {children}
      </td>
    ),
    blockquote: ({ children, ...props }) => (
      <blockquote className="my-2 border-l-2 border-chart-1 pl-4 text-muted-foreground italic" {...props}>
        {children}
      </blockquote>
    ),
    a: ({ children, href, node: _node, ...props }) => {
      const link = href?.trim() ?? "";
      if (!link) {
        return <span>{children}</span>;
      }

      if (link.startsWith("#")) {
        return (
          <a href={link} className="text-chart-1 hover:underline" {...props}>
            {children}
          </a>
        );
      }

      if (isExternalReference(link)) {
        return (
          <a href={link} className="text-chart-1 hover:underline" target="_blank" rel="noopener noreferrer" {...props}>
            {children}
          </a>
        );
      }

      return (
        <a
          href={link}
          className="text-chart-1 hover:underline"
          onClick={(event) => {
            event.preventDefault();
            setBlockedReference({
              href: link,
              reason: getBlockedReferenceReason(filePath),
            });
          }}
          {...props}
        >
          {children}
        </a>
      );
    },
    img: ({ src, alt, node: _node, ...props }) => (
      <MarkdownImage src={src} alt={alt} boardId={boardId} filePath={filePath} {...props} />
    ),
    ul: ({ children, ...props }) => (
      <ul className="my-1 ml-4 list-disc space-y-0.5" {...props}>
        {children}
      </ul>
    ),
    ol: ({ children, ...props }) => (
      <ol className="my-1 ml-4 list-decimal space-y-0.5" {...props}>
        {children}
      </ol>
    ),
    li: ({ children, ...props }) => <li {...props}>{children}</li>,
    hr: () => <hr className="my-4 border-border" />,
  } as Components;

  return (
    <div ref={setScrollRef} className="relative h-full overflow-auto px-4 py-3">
      <div ref={setContentRef} className={cn("prose-sm max-w-prose mx-auto text-foreground")}>
        <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins} components={components}>
          {markdown}
        </ReactMarkdown>
      </div>
      {overlay}

      <Dialog
        open={blockedReference !== null}
        onOpenChange={(open) => {
          if (!open) setBlockedReference(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Can&apos;t Open File Link Yet</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Opening local file links from markdown isn&apos;t supported yet. {blockedReference?.reason}
          </p>
          {blockedReference && (
            <pre className="max-h-40 overflow-auto rounded-md border border-border bg-muted/30 p-2 text-xs">
              {blockedReference.href}
            </pre>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MarkdownImage({
  src,
  alt,
  boardId,
  filePath,
  className,
  onError,
  ...props
}: React.ImgHTMLAttributes<HTMLImageElement> & { boardId?: string; filePath?: string }) {
  const [failed, setFailed] = useState(false);

  const resolution = useMemo(() => resolveImageSource(src, boardId, filePath), [boardId, filePath, src]);

  if (!resolution.src || failed) {
    const attempted = src?.trim() || "(empty image reference)";
    return (
      <span className="my-3 block rounded-md border border-dashed border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-900">
        <span className="block font-medium">Could not resolve image reference</span>
        <span className="mt-1 block break-all">{attempted}</span>
      </span>
    );
  }

  return (
    <img
      {...props}
      src={resolution.src}
      alt={alt ?? ""}
      className={cn("my-3 max-w-full rounded-md border border-border bg-card/40", className)}
      onError={(event) => {
        setFailed(true);
        onError?.(event);
      }}
    />
  );
}

function renderHeading(
  tag: "h1" | "h2" | "h3",
  children: React.ReactNode,
  props: Record<string, unknown>,
  sectionMap: Map<string, string>,
) {
  const text = extractText(children);
  const sectionId = sectionMap.get(text);

  const sizeClasses = {
    h1: "text-xl font-bold mt-4 mb-2",
    h2: "text-lg font-semibold mt-3 mb-1.5",
    h3: "text-base font-semibold mt-2 mb-1",
  };

  const Tag = tag;
  return (
    <Tag className={cn(sizeClasses[tag], "text-foreground")} data-section-id={sectionId} {...props}>
      {children}
    </Tag>
  );
}

function extractText(node: React.ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (!node) return "";
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (typeof node === "object" && "props" in node) {
    return extractText((node as { props: { children?: React.ReactNode } }).props.children);
  }
  return "";
}

function getBlockedReferenceReason(filePath?: string): string {
  if (!filePath) {
    return "This shape does not include a source file path to resolve relative links.";
  }
  if (!isAbsoluteLocalPath(filePath)) {
    return "The source file path is not absolute, so relative links cannot be resolved safely.";
  }
  return `Source file: ${filePath}`;
}

function resolveImageSource(
  src: string | undefined,
  boardId: string | undefined,
  filePath: string | undefined,
): { src: string | null } {
  const raw = src?.trim();
  if (!raw) return { src: null };
  if (raw.startsWith("#")) return { src: null };
  if (isExternalReference(raw)) return { src: raw };
  if (!boardId) return { src: null };

  return {
    src: buildReferencedFileUrl(boardId, raw, filePath?.trim() || undefined),
  };
}

function buildReferencedFileUrl(boardId: string, target: string, basePath?: string): string {
  const params = new URLSearchParams();
  params.set("target", target);
  if (basePath) {
    params.set("basePath", basePath);
  }
  return `/api/boards/${boardId}/files/content?${params.toString()}`;
}

function isAbsoluteLocalPath(value: string): boolean {
  return value.startsWith("/") || value.startsWith("\\\\") || /^[a-zA-Z]:[\\/]/.test(value);
}

function isExternalReference(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (isAbsoluteLocalPath(trimmed)) return false;
  if (trimmed.startsWith("//")) return true;

  const schemeMatch = /^([a-zA-Z][a-zA-Z\d+.-]*):/.exec(trimmed);
  if (!schemeMatch) return false;

  return schemeMatch[1].toLowerCase() !== "file";
}
