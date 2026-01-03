import { z } from "zod";

export const LeadStatusSchema = z.enum(["new", "contacted", "won", "lost"]);

export const LeadStatusPatchSchema = z
  .object({
    status: LeadStatusSchema,
  })
  .strict();

export type LeadStatus = z.infer<typeof LeadStatusSchema>;
export type LeadStatusPatch = z.infer<typeof LeadStatusPatchSchema>;
