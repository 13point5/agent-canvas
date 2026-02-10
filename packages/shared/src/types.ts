import type { z } from "zod";
import type {
  boardMetadataSchema,
  createBoardSchema,
  snapshotSchema,
  updateBoardSchema,
} from "./schemas";

export type BoardMetadata = z.infer<typeof boardMetadataSchema>;
export type CreateBoardInput = z.infer<typeof createBoardSchema>;
export type UpdateBoardInput = z.infer<typeof updateBoardSchema>;
export type Snapshot = z.infer<typeof snapshotSchema>;

export type BoardEvent =
  | { type: "board:created"; board: BoardMetadata }
  | { type: "board:updated"; board: BoardMetadata }
  | { type: "board:deleted"; boardId: string };
