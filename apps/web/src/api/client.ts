import type { BoardMetadata, CreateBoardInput } from "@agent-canvas/shared";
import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

// Query functions (for useQuery)
export const boardsApi = {
  list: () => api.get<BoardMetadata[]>("/boards").then((r) => r.data),

  get: (id: string) => api.get<BoardMetadata>(`/boards/${id}`).then((r) => r.data),
};

// Mutation functions (for useMutation)
export const boardsMutations = {
  create: (data: CreateBoardInput) => api.post<BoardMetadata>("/boards", data).then((r) => r.data),
};
