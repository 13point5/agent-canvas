import { Tldraw } from "tldraw";
import { ChatInput } from "@/components/board/chat-input";
import { useBoardPersistence } from "@/hooks/api/use-board-persistence";
import { MarkdownShapeUtil } from "@/tldraw-shapes/markdown";
import { markdownOverrides } from "@/tldraw-config/markdown-overrides";
import {
  CustomToolbar,
  MarkdownDialogOverlay,
  SelectionMentionToolbar,
} from "@/tldraw-config/markdown-toolbar";

const customShapeUtils = [MarkdownShapeUtil];

interface BoardCanvasProps {
  boardId: string;
}

export function BoardCanvas({ boardId }: BoardCanvasProps) {
  const { handleMount } = useBoardPersistence(boardId);

  return (
    <div className="relative h-full w-full" key={boardId}>
      <Tldraw
        onMount={handleMount}
        shapeUtils={customShapeUtils}
        overrides={markdownOverrides}
        components={{
          Toolbar: CustomToolbar,
          InFrontOfTheCanvas: BoardCanvasOverlay,
        }}
      />

      <div className="pointer-events-none absolute inset-x-0 bottom-4 z-50 flex justify-center px-4">
        <ChatInput />
      </div>
    </div>
  );
}

function BoardCanvasOverlay() {
  return (
    <>
      <MarkdownDialogOverlay />
      <SelectionMentionToolbar />
    </>
  );
}
