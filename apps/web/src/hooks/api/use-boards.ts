import { useQuery } from "@tanstack/react-query";
import { boardsApi } from "@/api/client";
import { queryKeys } from "@/api/queryClient";

export function useBoards() {
  return useQuery({
    queryKey: queryKeys.boards,
    queryFn: boardsApi.list,
  });
}

export function useBoard(boardId: string | undefined) {
  const { data: boards = [] } = useBoards();
  return boards.find((b) => b.id === boardId);
}
