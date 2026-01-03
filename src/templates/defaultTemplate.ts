import { TemplateDoc, TemplateLayout } from "./types";

export function buildDefaultTemplateLayout(): TemplateLayout {
  return {
    theme: { mode: "dark", radius: "2xl", container: "normal" },
    blocks: [
      {
        id: "hero",
        type: "hero",
        props: {
          headlineTemplate: "{service} in {place}",
          subheadline:
            "Answer a few questions. Get an instant rough estimate. Get matched with pros.",
          ctaText: "Get instant estimate",
          ctaSecondaryText: "Talk to a specialist",
          ctaTarget: "estimate",
          bullets: [
            "Transparent pricing guidance",
            "Vetted, licensed, and insured pros",
            "Options at different budgets",
            "Fast response and clean workmanship",
            "Warranty guidance and support",
            "Communication you can trust",
          ],
          badges: ["Licensed & insured", "Background checked", "Matched in minutes", "No spam"],
        },
      },
      {
        id: "trust",
        type: "trust",
        props: {
          sectionTitle: "Why homeowners choose us",
          stepsTitle: "How it works",
          testimonialsTitle: "Homeowner stories",
        },
      },
      {
        id: "estimator",
        type: "estimator",
        props: {
          title: "Instant estimate",
          subtitle: "Answer a few questions to get a fast, credible range.",
        },
      },
      {
        id: "services",
        type: "services",
        props: {
          scopeTitle: "{service} scope (typical)",
          pricingTitle: "Pricing guidance",
          serviceAreaTitle: "Serving {city} and nearby",
        },
      },
      {
        id: "faq",
        type: "faq",
        props: {
          title: "FAQ",
        },
      },
      {
        id: "cta",
        type: "cta",
        props: {
          title: "Get your estimate in 60 seconds",
          subtitle: "Quick, no-pressure estimate for {service} in {city}.",
          buttonText: "Get instant estimate",
        },
      },
      {
        id: "footer",
        type: "footer",
        props: {
          disclaimer: "Fast estimates and professional service.",
        },
      },
    ],
  };
}

export function buildDefaultTemplateDoc(): TemplateDoc {
  const layout = buildDefaultTemplateLayout();
  return {
    templateId: "default",
    name: "Default",
    status: "draft",
    publishedVersion: 1,
    draftVersion: 1,
    draft: layout,
    published: layout,
  };
}
