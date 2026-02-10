import type {
  BoardMetadata,
  CreateBoardInput,
  Snapshot,
  UpdateBoardInput,
} from "@agent-canvas/shared";
import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

// Query functions (for useQuery)
export const boardsApi = {
  list: () => api.get<BoardMetadata[]>("/boards").then((r) => r.data),

  get: (id: string) => api.get<BoardMetadata>(`/boards/${id}`).then((r) => r.data),

  getSnapshot: (id: string) =>
    api.get<{ snapshot: Snapshot | null }>(`/boards/${id}/snapshot`).then((r) => r.data),
};

// Mutation functions (for useMutation)
export const boardsMutations = {
  create: (data: CreateBoardInput) => api.post<BoardMetadata>("/boards", data).then((r) => r.data),

  update: ({ id, data }: { id: string; data: UpdateBoardInput }) =>
    api.patch<BoardMetadata>(`/boards/${id}`, data).then((r) => r.data),

  delete: (id: string) => api.delete<{ success: boolean }>(`/boards/${id}`).then((r) => r.data),

  saveSnapshot: ({ id, snapshot }: { id: string; snapshot: Snapshot }) =>
    api.put<{ success: boolean }>(`/boards/${id}/snapshot`, snapshot).then((r) => r.data),
};
