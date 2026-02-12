import { Tldraw } from "tldraw";
import { useBoardPersistence } from "@/hooks/api/use-board-persistence";
import { MarkdownShapeUtil } from "@/tldraw-shapes/markdown";

const customShapeUtils = [MarkdownShapeUtil];

interface BoardCanvasProps {
  boardId: string;
}

export function BoardCanvas({ boardId }: BoardCanvasProps) {
  const { handleMount } = useBoardPersistence(boardId);

  return (
    <div className="h-full w-full" key={boardId}>
      <Tldraw onMount={handleMount} shapeUtils={customShapeUtils} />
    </div>
  );
}
