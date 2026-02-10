import { useNavigate, useParams } from "react-router-dom";
import { BoardMenuItem } from "@/components/sidebar";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
} from "@/components/ui/sidebar";
import { useBoards } from "@/hooks/api/use-boards";

export function AppSidebar() {
  const navigate = useNavigate();
  const { boardId } = useParams<{ boardId: string }>();

  const { data: boards = [] } = useBoards();

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="flex-row! p-0! h-12 items-center px-2!">
        <span className="font-semibold text-base pl-3">Agent Canvas</span>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
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
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
