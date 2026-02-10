import type { z } from "zod";
import type { boardMetadataSchema } from "./schemas";

export type BoardMetadata = z.infer<typeof boardMetadataSchema>;
