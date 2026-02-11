import type { z } from "zod";
import type {
  boardMetadataSchema,
  createBoardSchema,
  createShapesBodySchema,
  inputShapeSchema,
  snapshotSchema,
  updateBoardSchema,
} from "./schemas";

export type BoardMetadata = z.infer<typeof boardMetadataSchema>;
export type CreateBoardInput = z.infer<typeof createBoardSchema>;
export type UpdateBoardInput = z.infer<typeof updateBoardSchema>;
export type Snapshot = z.infer<typeof snapshotSchema>;
export type InputShape = z.infer<typeof inputShapeSchema>;
export type CreateShapesBody = z.infer<typeof createShapesBodySchema>;

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
