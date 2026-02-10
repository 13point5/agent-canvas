import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";

interface BoardMenuItemProps {
  board: { id: string; name: string };
  isActive: boolean;
  onNavigate: () => void;
}

export function BoardMenuItem({
  board,
  isActive,
  onNavigate,
}: BoardMenuItemProps) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton isActive={isActive} onClick={onNavigate}>
        <span>{board.name}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
