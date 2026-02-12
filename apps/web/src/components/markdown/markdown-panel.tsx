import { useMemo, useRef } from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

import type { MermaidBlock, ParsedMarkdown } from "@/lib/parse-markdown";

import { MermaidBlock as MermaidBlockComponent } from "./mermaid-block";

const remarkPlugins = [remarkGfm, remarkMath];
const rehypePlugins = [rehypeKatex];

interface MarkdownPanelProps {
  markdown: string;
  parsed: ParsedMarkdown;
  mermaidBlocks: MermaidBlock[];
  onPinDiagram?: (id: string) => void;
}

export function MarkdownPanel({
  markdown,
  parsed,
  mermaidBlocks,
  onPinDiagram,
}: MarkdownPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Map mermaid code content → block for direct lookup (no counter needed)
  const mermaidByCode = useMemo(
    () => new Map(mermaidBlocks.map((b) => [b.code, b])),
    [mermaidBlocks],
  );

  // Derived mapping: heading text -> section id
  const sectionMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const section of parsed.sections) {
      map.set(section.title, section.id);
    }
    return map;
  }, [parsed]);

  const components: Components = {
    // Our `code` component handles its own wrapping — skip the default <pre>
    pre: ({ children }) => <>{children}</>,

    h1: ({ children, ...props }) =>
      renderHeading("h1", children, props, sectionMap),
    h2: ({ children, ...props }) =>
      renderHeading("h2", children, props, sectionMap),
    h3: ({ children, ...props }) =>
      renderHeading("h3", children, props, sectionMap),

    code: ({ className, children, ...props }) => {
      const match = /language-(\w+)/.exec(className ?? "");
      const lang = match?.[1];

      if (lang === "mermaid") {
        const raw = extractText(children).trim();
        const block = mermaidByCode.get(raw);
        if (!block) return null;
        return (
          <MermaidBlockComponent
            id={block.id}
            code={block.code}
            onPinToPanel={onPinDiagram}
          />
        );
      }

      // Inline code
      if (!match) {
        return (
          <code
            className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-sm"
            {...props}
          >
            {children}
          </code>
        );
      }

      // Fenced code block
      return (
        <pre className="my-2 overflow-auto rounded-md border border-border bg-muted/30 p-3">
          <code className={`font-mono text-sm ${className ?? ""}`} {...props}>
            {children}
          </code>
        </pre>
      );
    },

    // Style other markdown elements
    table: ({ children, ...props }) => (
      <div className="my-3 overflow-auto">
        <table className="w-full border-collapse text-sm" {...props}>
          {children}
        </table>
      </div>
    ),
    th: ({ children, ...props }) => (
      <th
        className="border border-border bg-muted px-3 py-1.5 text-left font-medium"
        {...props}
      >
        {children}
      </th>
    ),
    td: ({ children, ...props }) => (
      <td className="border border-border px-3 py-1.5" {...props}>
        {children}
      </td>
    ),
    blockquote: ({ children, ...props }) => (
      <blockquote
        className="my-2 border-l-2 border-chart-1 pl-4 text-muted-foreground italic"
        {...props}
      >
        {children}
      </blockquote>
    ),
    a: ({ children, href, ...props }) => (
      <a
        href={href}
        className="text-chart-1 hover:underline"
        target="_blank"
        rel="noopener noreferrer"
        {...props}
      >
        {children}
      </a>
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
    hr: () => <hr className="my-4 border-border" />,
  } as Components;

  return (
    <div ref={scrollRef} className="h-full overflow-auto px-4 py-3">
      <div className="prose-sm max-w-prose mx-auto text-foreground">
        <ReactMarkdown
          remarkPlugins={remarkPlugins}
          rehypePlugins={rehypePlugins}
          components={components}
        >
          {markdown}
        </ReactMarkdown>
      </div>
    </div>
  );
}

function renderHeading(
  Tag: "h1" | "h2" | "h3",
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

  return (
    <Tag
      className={`${sizeClasses[Tag]} text-foreground`}
      data-section-id={sectionId}
      {...props}
    >
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
    return extractText(
      (node as { props: { children?: React.ReactNode } }).props.children,
    );
  }
  return "";
}
