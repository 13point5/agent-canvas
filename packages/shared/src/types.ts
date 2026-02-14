import type { z } from "zod";
import type {
  appSettingsSchema,
  boardMetadataSchema,
  createBoardSchema,
  createShapesBodySchema,
  deleteShapesBodySchema,
  fileBackedShapeSchema,
  fileBackedUpdateShapeSchema,
  inputShapeSchema,
  snapshotSchema,
  updateBoardSchema,
  updateShapeSchema,
  updateShapesBodySchema,
} from "./schemas";

export type BoardMetadata = z.infer<typeof boardMetadataSchema>;
export type CreateBoardInput = z.infer<typeof createBoardSchema>;
export type UpdateBoardInput = z.infer<typeof updateBoardSchema>;
export type Snapshot = z.infer<typeof snapshotSchema>;
export type InputShape = z.infer<typeof inputShapeSchema>;
export type FileBackedShape = z.infer<typeof fileBackedShapeSchema>;
export type CreateShapesBody = z.infer<typeof createShapesBodySchema>;
export type AppSettings = z.infer<typeof appSettingsSchema>;

export type BoardEvent =
  | { type: "board:created"; board: BoardMetadata }
  | { type: "board:updated"; board: BoardMetadata }
  | { type: "board:deleted"; boardId: string };

// Server → Client requests
export type GetShapesRequest = {
  type: "get-shapes:request";
  requestId: string;
  boardId: string;
};
export type CreateShapesRequest = {
  type: "create-shapes:request";
  requestId: string;
  boardId: string;
  shapes: InputShape[];
};

// Client → Server responses
export type GetShapesResponse = {
  type: "get-shapes:response";
  requestId: string;
  shapes: unknown[] | null;
  error?: string;
};
export type CreateShapesResponse = {
  type: "create-shapes:response";
  requestId: string;
  createdIds: string[] | null;
  idMap?: Record<string, string>;
  error?: string;
};

// API response types
export type GetShapesApiResponse = { boardId: string; shapes: unknown[] };
export type CreateShapesApiResponse = {
  boardId: string;
  createdIds: string[];
  idMap?: Record<string, string>;
  assetPaths?: Record<string, string>;
};

// ── Update shapes ────────────────────────────────────────────────────

export type UpdateShape = z.infer<typeof updateShapeSchema>;
export type FileBackedUpdateShape = z.infer<typeof fileBackedUpdateShapeSchema>;
export type UpdateShapesBody = z.infer<typeof updateShapesBodySchema>;

export type UpdateShapesRequest = {
  type: "update-shapes:request";
  requestId: string;
  boardId: string;
  shapes: UpdateShape[];
};
export type UpdateShapesResponse = {
  type: "update-shapes:response";
  requestId: string;
  updatedIds: string[] | null;
  error?: string;
};
export type UpdateShapesApiResponse = {
  boardId: string;
  updatedIds: string[];
};

// ── Delete shapes ────────────────────────────────────────────────────

export type DeleteShapesBody = z.infer<typeof deleteShapesBodySchema>;

export type DeleteShapesRequest = {
  type: "delete-shapes:request";
  requestId: string;
  boardId: string;
  ids: string[];
};
export type DeleteShapesResponse = {
  type: "delete-shapes:response";
  requestId: string;
  deletedIds: string[] | null;
  error?: string;
};
export type DeleteShapesApiResponse = {
  boardId: string;
  deletedIds: string[];
};
