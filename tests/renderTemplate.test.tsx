import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { renderTemplate } from "@/templates/renderTemplate";
import type { TemplateLayout } from "@/templates/types";

describe("renderTemplate", () => {
  it("renders schema markup when FAQs exist", () => {
    const layout: TemplateLayout = {
      theme: { mode: "dark", radius: "2xl", container: "normal" },
      blocks: [
        { id: "hero", type: "hero", props: {} },
        { id: "faq", type: "faq", props: {} },
        { id: "footer", type: "footer", props: {} },
      ],
    };

    const page = {
      county: { name: "Los Angeles", slug: "los-angeles" },
      city: { name: "Los Angeles", slug: "los-angeles" },
      service: { name: "Roofing", slug: "roofing" },
      zip: "90001",
      slugPath: "/los-angeles/90001/downtown/roofing",
      content: {
        faqs: [{ q: "Test question", a: "Test answer" }],
      },
    } as any;

    const html = renderToStaticMarkup(renderTemplate(layout, page, "public"));
    expect(html).toContain("application/ld+json");
    expect(html).toContain("FAQPage");
  });
});
