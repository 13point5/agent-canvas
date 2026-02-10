import { Tldraw } from "tldraw";
import { useBoardPersistence } from "@/hooks/api/use-board-persistence";

interface BoardCanvasProps {
  boardId: string;
}

export function BoardCanvas({ boardId }: BoardCanvasProps) {
  const { handleMount } = useBoardPersistence(boardId);

  return (
    <div className="h-full w-full" key={boardId}>
      <Tldraw onMount={handleMount} />
    </div>
  );
}
