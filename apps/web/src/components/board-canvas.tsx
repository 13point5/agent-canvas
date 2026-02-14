import {
  DefaultToolbar,
  DefaultToolbarContent,
  type TLUiOverrides,
  Tldraw,
  ToolbarItem,
} from "tldraw";
import { useBoardPersistence } from "@/hooks/api/use-board-persistence";
import { htmlOverrides } from "@/tldraw-config/html-overrides";
import { HtmlDialogOverlay } from "@/tldraw-config/html-toolbar";
import { markdownOverrides } from "@/tldraw-config/markdown-overrides";
import { MarkdownDialogOverlay } from "@/tldraw-config/markdown-toolbar";
import { HtmlShapeUtil } from "@/tldraw-shapes/html";
import { MarkdownShapeUtil } from "@/tldraw-shapes/markdown";

const customShapeUtils = [MarkdownShapeUtil, HtmlShapeUtil];

const combinedOverrides: TLUiOverrides = {
  tools(editor, tools, helpers) {
    markdownOverrides.tools?.(editor, tools, helpers);
    htmlOverrides.tools?.(editor, tools, helpers);
    return tools;
  },
  translations: {
    ...markdownOverrides.translations,
    en: {
      ...(markdownOverrides.translations as Record<string, Record<string, string>>)?.en,
      ...(htmlOverrides.translations as Record<string, Record<string, string>>)?.en,
    },
  },
};

function CombinedDialogOverlay() {
  return (
    <>
      <MarkdownDialogOverlay />
      <HtmlDialogOverlay />
    </>
  );
}

function CustomToolbar() {
  return (
    <DefaultToolbar>
      <DefaultToolbarContent />
      <ToolbarItem tool="markdown" />
      <ToolbarItem tool="html" />
    </DefaultToolbar>
  );
}

interface BoardCanvasProps {
  boardId: string;
}

export function BoardCanvas({ boardId }: BoardCanvasProps) {
  const { handleMount } = useBoardPersistence(boardId);

  return (
    <div className="h-full w-full" key={boardId}>
      <Tldraw
        onMount={handleMount}
        shapeUtils={customShapeUtils}
        overrides={combinedOverrides}
        components={{
          Toolbar: CustomToolbar,
          InFrontOfTheCanvas: CombinedDialogOverlay,
        }}
      />
    </div>
  );
}
