import { z } from "zod";

export const BulkActionSchema = z.enum(["publish", "unpublish", "qa"]);

export const PagesBulkRequestSchema = z
  .object({
    action: BulkActionSchema,
    pageIds: z.array(z.string().min(1)).min(1).max(500),
    force: z.boolean().optional(),
  })
  .strict();

export type PagesBulkRequest = z.infer<typeof PagesBulkRequestSchema>;
