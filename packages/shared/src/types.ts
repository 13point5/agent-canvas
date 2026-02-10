import type { z } from "zod";
import type { boardMetadataSchema, createBoardSchema } from "./schemas";

export type BoardMetadata = z.infer<typeof boardMetadataSchema>;
export type CreateBoardInput = z.infer<typeof createBoardSchema>;

export type BoardEvent =
  | { type: "board:created"; board: BoardMetadata }
  | { type: "board:updated"; board: BoardMetadata }
  | { type: "board:deleted"; boardId: string };
