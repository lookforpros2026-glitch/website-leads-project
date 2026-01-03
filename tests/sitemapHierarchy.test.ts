import { describe, expect, it } from "vitest";
import { buildSitemapEntries } from "@/lib/sitemap-entries";

describe("sitemapChunkIncludesHierarchy", () => {
  it("includes place, place/service, and neighborhood/service URLs", () => {
    const pages = [
      {
        countySlug: "la-county",
        zip: "91306",
        placeSlug: "winnetka",
        service: { key: "roof-repair" },
        updatedAt: { toMillis: () => 1700000000000 },
      },
    ];
    const base = "https://example.com";
    const entries = buildSitemapEntries(pages, base);
    const urls = entries.map((e) => e.url);

    expect(urls).toContain("https://example.com/la-county/91306");
    expect(urls).toContain("https://example.com/la-county/91306/s/roof-repair");
    expect(urls).toContain("https://example.com/la-county/91306/n/winnetka");
    expect(urls).toContain("https://example.com/la-county/91306/n/winnetka/roof-repair");
  });
});
