import { describe, it, expect } from "vitest";
import { REQUIRED_SECTIONS, QA_RULES } from "@/lib/pageHealthRules";

describe("pageHealthRules", () => {
  it("includes required sections", () => {
    expect(REQUIRED_SECTIONS).toContain("hero");
    expect(REQUIRED_SECTIONS).toContain("faqs");
    expect(REQUIRED_SECTIONS).toContain("cta");
  });

  it("includes core QA rule codes", () => {
    const codes = QA_RULES.map((r) => r.code);
    expect(codes).toContain("missing_title");
    expect(codes).toContain("missing_h1");
    expect(codes).toContain("slug_invalid");
  });
});
