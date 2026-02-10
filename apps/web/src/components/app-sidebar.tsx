import { AddSquareIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { boardsMutations } from "@/api/client";
import { queryKeys } from "@/api/queryClient";
import { BoardMenuItem } from "@/components/sidebar";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useBoards } from "@/hooks/api/use-boards";

export function AppSidebar() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { boardId } = useParams<{ boardId: string }>();

  const { data: boards = [] } = useBoards();

  const createBoard = useMutation({
    mutationFn: boardsMutations.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.boards });
    },
  });

  const updateBoard = useMutation({
    mutationFn: boardsMutations.update,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.boards });
    },
  });

  const handleCreateBoard = async () => {
    const now = new Date();
    const name =
      now.toLocaleDateString("en-US", { weekday: "short" }) +
      " " +
      now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    const board = await createBoard.mutateAsync({ name });
    navigate(`/board/${board.id}`);
  };

  const handleRenameBoard = (id: string, newName: string) => {
    updateBoard.mutate({ id, data: { name: newName } });
  };

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="flex-row! p-0! h-12 items-center px-2!">
        <span className="font-semibold text-base pl-3">Agent Canvas</span>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={handleCreateBoard}>
                  <HugeiconsIcon icon={AddSquareIcon} strokeWidth={2} />
                  <span>New Board</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>

            <div className="mt-4 mb-2 px-3">
              <span className="text-sm text-muted-foreground">Boards</span>
            </div>

            <SidebarMenu>
              {boards.map((board) => (
                <BoardMenuItem
                  key={board.id}
                  board={board}
                  isActive={boardId === board.id}
                  onNavigate={() => navigate(`/board/${board.id}`)}
                  onRename={(newName) => handleRenameBoard(board.id, newName)}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
