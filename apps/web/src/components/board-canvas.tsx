import { Tldraw } from "tldraw";
import { useBoardPersistence } from "@/hooks/api/use-board-persistence";
import { VisualMarkdownShapeUtil } from "@/features/visual-markdown";

const customShapeUtils = [VisualMarkdownShapeUtil];

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
