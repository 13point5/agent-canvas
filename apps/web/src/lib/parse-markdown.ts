export interface MermaidBlock {
  id: string;
  code: string;
  sectionId: string | null;
}

export interface Section {
  id: string;
  title: string;
  level: number;
  mermaidBlocks: MermaidBlock[];
}

export interface ParsedMarkdown {
  sections: Section[];
  mermaidBlocks: MermaidBlock[];
}

export function parseMarkdown(raw: string): ParsedMarkdown {
  const lines = raw.split("\n");
  const sections: Section[] = [];
  const mermaidBlocks: MermaidBlock[] = [];

  let currentSection: Section | null = null;
  let mermaidIndex = 0;
  let sectionIndex = 0;

  const headingRegex = /^(#{1,3})\s+(.+)$/;

  let inCodeBlock = false;
  let codeBlockLang = "";
  let codeBlockLines: string[] = [];
  let codeBlockIsMermaid = false;

  for (const line of lines) {
    if (line.startsWith("```")) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        const infoString = line.slice(3).trim();
        codeBlockLang = infoString.split(/\s+/)[0] || "";
        codeBlockLines = [];
        codeBlockIsMermaid = codeBlockLang === "mermaid";
      } else {
        inCodeBlock = false;
        const code = codeBlockLines.join("\n");

        if (codeBlockIsMermaid) {
          const sectionId = currentSection?.id ?? null;
          const block: MermaidBlock = {
            id: `mermaid-${mermaidIndex++}`,
            code,
            sectionId,
          };
          mermaidBlocks.push(block);
          if (currentSection) {
            currentSection.mermaidBlocks.push(block);
          }
        }

        codeBlockLang = "";
        codeBlockLines = [];
        codeBlockIsMermaid = false;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      continue;
    }

    const headingMatch = line.match(headingRegex);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const title = headingMatch[2].trim();
      currentSection = {
        id: `section-${sectionIndex++}`,
        title,
        level,
        mermaidBlocks: [],
      };
      sections.push(currentSection);
    }
  }

  return { sections, mermaidBlocks };
}
