import { Tldraw } from "tldraw";
import { useBoardPersistence } from "@/hooks/api/use-board-persistence";
import { DbSchemaShapeUtil } from "@/tldraw-shapes/db-schema";
import { MarkdownShapeUtil } from "@/tldraw-shapes/markdown";
import { markdownOverrides } from "@/tldraw-config/markdown-overrides";
import {
  CustomToolbar,
  DbSchemaDialogOverlay,
  MarkdownDialogOverlay,
} from "@/tldraw-config/markdown-toolbar";

const customShapeUtils = [MarkdownShapeUtil, DbSchemaShapeUtil];

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
        overrides={markdownOverrides}
        components={{
          Toolbar: CustomToolbar,
          InFrontOfTheCanvas: () => (
            <>
              <MarkdownDialogOverlay />
              <DbSchemaDialogOverlay />
            </>
          ),
        }}
      />
    </div>
  );
}
