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
