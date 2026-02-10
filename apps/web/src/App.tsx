import { Route, Routes } from "react-router-dom";
import { AppLayout } from "@/components/board";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useBoards } from "@/hooks/api/use-boards";
import { useWebSocket } from "@/hooks/api/use-websocket";
import { BoardPage, HomePage } from "@/pages";

export function App() {
  useWebSocket();

  const { isLoading } = useBoards();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen text-muted-foreground">
        Loading...
      </div>
    );
  }

  return (
    <TooltipProvider>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/board/:boardId" element={<BoardPage />} />
          <Route path="*" element={<HomePage />} />
        </Route>
      </Routes>
    </TooltipProvider>
  );
}

export default App;
