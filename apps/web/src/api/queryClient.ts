import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      retry: 1,
    },
  },
});

export const queryKeys = {
  boards: ["boards"] as const,
  board: (id: string) => ["boards", id] as const,
  snapshot: (id: string) => ["boards", id, "snapshot"] as const,
};
