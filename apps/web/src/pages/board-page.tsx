import { useParams } from "react-router-dom";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useBoard } from "@/hooks/api/use-boards";

export function BoardPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const board = useBoard(boardId);

  return (
    <>
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-2">
        <SidebarTrigger />
        <span className="font-medium">{board?.name ?? "Board"}</span>
      </header>
      <main className="flex-1 overflow-hidden">
        <div className="flex items-center justify-center h-full text-muted-foreground">
          Canvas coming soon
        </div>
      </main>
    </>
  );
}
