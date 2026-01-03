import { z } from "zod";

export const LeadPayloadSchema = z
  .object({
    pageSlug: z.string().min(2).max(200),
    pagePath: z.string().max(400).optional(),
    sessionId: z.string().max(120).optional(),
    fullName: z.string().min(2).max(120),
    phone: z.string().min(7).max(30),
    email: z
      .string()
      .email()
      .max(254)
      .optional()
      .or(z.literal(""))
      .transform((v) => (v ? v : undefined)),
    message: z
      .string()
      .max(2000)
      .optional()
      .or(z.literal(""))
      .transform((v) => (v ? v : undefined)),
    answers: z.record(z.string(), z.any()).optional(),
    hp: z.string().optional(), // honeypot
    gclid: z.string().max(200).optional(),
    serviceKey: z.string().max(120).optional(),
    countySlug: z.string().max(120).optional(),
    citySlug: z.string().max(120).optional(),
    zip: z.string().max(20).optional(),
    utm: z
      .object({
        source: z.string().max(100).optional(),
        medium: z.string().max(100).optional(),
        campaign: z.string().max(150).optional(),
        term: z.string().max(150).optional(),
        content: z.string().max(150).optional(),
      })
      .optional(),
    referrer: z.string().max(1000).optional(),
  })
  .strict();

export type LeadPayload = z.infer<typeof LeadPayloadSchema>;
