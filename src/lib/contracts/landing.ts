import { slugify as slugifyBase } from "@/lib/slug";

export type LandingFAQ = { q: string; a: string };

export type LandingContent = {
  service: string;
  city: string;
  hero: {
    headline: string;
    subheadline: string;
    bullets: string[];
  };
  trust: {
    badges: string[];
    reviewSnippet: {
      quote: string;
      name: string;
      city?: string;
    };
  };
  process: {
    steps: Array<{ title: string; body: string }>;
  };
  local: {
    paragraph: string;
    nearbyAreas: string[];
  };
  faq: LandingFAQ[];
  seo: {
    title: string;
    description: string;
    canonicalPath: string;
  };
};

export function slugify(input: string) {
  return slugifyBase(input);
}

export function clampLanding(content: Partial<LandingContent>): LandingContent {
  const service = (content.service ?? "").trim() || "Service";
  const city = (content.city ?? "").trim() || "Your Area";

  const canonicalPath =
    content.seo?.canonicalPath?.startsWith("/")
      ? content.seo?.canonicalPath
      : `/${slugify(service)}/${slugify(city)}`;

  return {
    service,
    city,
    hero: {
      headline: content.hero?.headline?.trim() || `${service} in ${city}`,
      subheadline:
        content.hero?.subheadline?.trim() || "Get a fast, no-pressure estimate from a vetted local team.",
      bullets:
        (content.hero?.bullets ?? []).filter(Boolean).slice(0, 5).length > 0
          ? (content.hero?.bullets ?? []).filter(Boolean).slice(0, 5)
          : ["Fast estimates", "Clear pricing", "Clean, professional crews"],
    },
    trust: {
      badges:
        (content.trust?.badges ?? []).filter(Boolean).slice(0, 6).length > 0
          ? (content.trust?.badges ?? []).filter(Boolean).slice(0, 6)
          : ["Licensed & insured", "On-time scheduling", "Quality workmanship"],
      reviewSnippet: {
        quote:
          content.trust?.reviewSnippet?.quote?.trim() ||
          "They showed up on time, explained everything clearly, and the final result looked amazing.",
        name: content.trust?.reviewSnippet?.name?.trim() || "Homeowner",
        city: content.trust?.reviewSnippet?.city?.trim() || city,
      },
    },
    process: {
      steps:
        (content.process?.steps ?? []).filter(Boolean).slice(0, 3).length > 0
          ? (content.process?.steps ?? []).filter(Boolean).slice(0, 3)
          : [
              { title: "Tell us what you need", body: "Share the details and timeline." },
              { title: "Get a fast estimate", body: "We review and respond quickly." },
              { title: "Schedule the work", body: "Pick a time that works for you." },
            ],
    },
    local: {
      paragraph:
        content.local?.paragraph?.trim() ||
        `We provide ${service.toLowerCase()} services across ${city} with a clean, professional process and clear communication from start to finish.`,
      nearbyAreas:
        (content.local?.nearbyAreas ?? []).filter(Boolean).slice(0, 12).length > 0
          ? (content.local?.nearbyAreas ?? []).filter(Boolean).slice(0, 12)
          : [],
    },
    faq:
      (content.faq ?? []).filter((x) => x?.q && x?.a).slice(0, 10).length > 0
        ? (content.faq ?? []).filter((x) => x?.q && x?.a).slice(0, 10)
        : [
            { q: "How fast can I get an estimate?", a: "Usually the same day or within 24 hours." },
            { q: "Do you offer on-site visits?", a: "Yes, if needed for accuracy and scope." },
            { q: "Are you licensed and insured?", a: "Yes, we work with licensed and insured pros." },
          ],
    seo: {
      title: content.seo?.title?.trim() || `${service} in ${city} | Fast Estimate`,
      description:
        content.seo?.description?.trim() ||
        `Request a fast estimate for ${service.toLowerCase()} in ${city}. Professional crews, clear pricing, and quick scheduling.`,
      canonicalPath,
    },
  };
}
