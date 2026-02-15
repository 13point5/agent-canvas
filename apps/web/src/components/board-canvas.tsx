import { DefaultToolbar, DefaultToolbarContent, type TLUiOverrides, Tldraw, ToolbarItem } from "tldraw";
import { useBoardPersistence } from "@/hooks/api/use-board-persistence";
import { codeDiffOverrides } from "@/tldraw-config/code-diff-overrides";
import { htmlOverrides } from "@/tldraw-config/html-overrides";
import { HtmlDialogOverlay } from "@/tldraw-config/html-toolbar";
import { markdownOverrides } from "@/tldraw-config/markdown-overrides";
import { MarkdownDialogOverlay } from "@/tldraw-config/markdown-toolbar";
import { SelectionIdsToolbar } from "@/tldraw-config/selection-ids-toolbar";
import { CodeDiffShapeUtil } from "@/tldraw-shapes/code-diff";
import { HtmlShapeUtil } from "@/tldraw-shapes/html";
import { MarkdownShapeUtil } from "@/tldraw-shapes/markdown";

const customShapeUtils = [MarkdownShapeUtil, HtmlShapeUtil, CodeDiffShapeUtil];

const combinedOverrides: TLUiOverrides = {
  tools(editor, tools, helpers) {
    markdownOverrides.tools?.(editor, tools, helpers);
    htmlOverrides.tools?.(editor, tools, helpers);
    codeDiffOverrides.tools?.(editor, tools, helpers);
    return tools;
  },
  translations: {
    ...markdownOverrides.translations,
    en: {
      ...(markdownOverrides.translations as Record<string, Record<string, string>>)?.en,
      ...(htmlOverrides.translations as Record<string, Record<string, string>>)?.en,
      ...(codeDiffOverrides.translations as Record<string, Record<string, string>>)?.en,
    },
  },
};

function CombinedDialogOverlay() {
  return (
    <>
      <SelectionIdsToolbar />
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
      <ToolbarItem tool="code-diff" />
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
