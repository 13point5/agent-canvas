import { Navigate } from "react-router-dom";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useBoards } from "@/hooks/api/use-boards";
import { useSettings } from "@/hooks/api/use-settings";

export function HomePage() {
  const { data: boards = [] } = useBoards();
  const { data: settings } = useSettings();

  if (boards.length > 0) {
    const lastId = settings?.lastActiveBoardId;
    const target =
      lastId && boards.some((b) => b.id === lastId) ? lastId : boards[0].id;
    return <Navigate to={`/board/${target}`} replace />;
  }

  return (
    <>
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-2">
        <SidebarTrigger />
        <span className="font-medium">No board selected</span>
      </header>
      <main className="flex-1 overflow-hidden">
        <div className="flex items-center justify-center h-full text-muted-foreground">
          Select or create a board
        </div>
      </main>
    </>
  );
}
