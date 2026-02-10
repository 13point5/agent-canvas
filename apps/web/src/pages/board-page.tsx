import { Copy01Icon, Tick01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { BoardCanvas } from "@/components/board-canvas";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useBoard } from "@/hooks/api/use-boards";

export function BoardPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const board = useBoard(boardId);
  const [copied, setCopied] = useState(false);

  const handleCopyId = () => {
    if (!boardId) return;
    navigator.clipboard.writeText(boardId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <>
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-2">
        <SidebarTrigger />
        <span className="font-medium">{board?.name ?? "Board"}</span>
        <Button
          variant="ghost"
          size="icon-sm"
          className="ml-auto"
          onClick={handleCopyId}
        >
          <HugeiconsIcon
            icon={copied ? Tick01Icon : Copy01Icon}
            strokeWidth={2}
          />
        </Button>
      </header>
      <main className="flex-1 overflow-hidden">
        {board ? (
          <BoardCanvas boardId={board.id} />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Board not found
          </div>
        )}
      </main>
    </>
  );
}
