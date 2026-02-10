import { z } from "zod";

export const boardMetadataSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createBoardSchema = z.object({
  name: z.string().min(1),
});

export const updateBoardSchema = z.object({
  name: z.string().min(1).optional(),
});

export const snapshotSchema = z.object({
  document: z.unknown(),
  session: z.unknown().optional(),
});
