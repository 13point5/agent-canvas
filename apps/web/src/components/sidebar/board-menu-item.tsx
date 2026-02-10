import { MoreVerticalIcon, PencilEdit01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { RenameBoardDialog } from "./dialogs/rename-board-dialog";

interface BoardMenuItemProps {
  board: { id: string; name: string };
  isActive: boolean;
  onNavigate: () => void;
  onRename: (newName: string) => void;
}

export function BoardMenuItem({ board, isActive, onNavigate, onRename }: BoardMenuItemProps) {
  const [showRenameDialog, setShowRenameDialog] = useState(false);

  return (
    <SidebarMenuItem className="group/item">
      <SidebarMenuButton isActive={isActive} onClick={onNavigate}>
        <span>{board.name}</span>
      </SidebarMenuButton>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover/item:opacity-100 data-[state=open]:opacity-100"
          >
            <HugeiconsIcon icon={MoreVerticalIcon} strokeWidth={2} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => setShowRenameDialog(true)}>
            <HugeiconsIcon icon={PencilEdit01Icon} strokeWidth={2} />
            Rename
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {showRenameDialog && (
        <RenameBoardDialog
          onOpenChange={setShowRenameDialog}
          boardName={board.name}
          onConfirm={onRename}
        />
      )}
    </SidebarMenuItem>
  );
}
