export const PAGE_HEALTH_VERSION = 1;

export const REQUIRED_SECTIONS = [
  "hero",
  "intro",
  "content",
  "faqs",
  "cta",
] as const;

export const MIN_LENGTHS: Record<string, number> = {
  intro: 200,
  content: 300,
  faqs: 80,
};

export const QA_RULES = [
  { code: "missing_title", severity: "fail" },
  { code: "missing_h1", severity: "fail" },
  { code: "slug_invalid", severity: "fail" },
  { code: "missing_faq", severity: "warn" },
  { code: "missing_schema", severity: "warn" },
  { code: "faqs_too_few", severity: "warn" },
  { code: "content_too_short", severity: "warn" },
] as const;

export type QARuleCode = (typeof QA_RULES)[number]["code"];
