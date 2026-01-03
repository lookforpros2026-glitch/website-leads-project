import { slugify } from "./slug";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

const REQUIRED_SECTION_IDS = [
  "overview",
  "what_includes",
  "local_considerations",
  "cost",
  "timeline",
  "permits",
  "how_to_choose",
  "our_process",
];

function hashSeed(key: string) {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash << 5) - hash + key.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function pick<T>(list: T[], seed: number) {
  return list[seed % list.length];
}

const sentenceBanks: Record<string, string[]> = {
  overview: [
    "Our {service} team in {city} blends planning discipline with on-site craftsmanship to deliver work that holds up under LA's pace.",
    "In {city}, {service} projects demand coordination across trades, neighbors, and inspectors; we run it like a calm, repeatable playbook.",
  ],
  what_includes: [
    "Scope covers discovery, design assist, procurement guidance, build execution, and punch walks with transparent weekly updates.",
    "We handle survey, layout, materials vetting, scheduling, build sequencing, and close-out so you see steady, visible progress.",
  ],
  local_considerations: [
    "{city} homes range from post-war bungalows to new builds; we match methods to framing, utilities, and HOAs in this pocket of LA County.",
    "Soils, easements, and narrow streets across {city} change access plans; we stage deliveries and crews to keep neighbors comfortable.",
  ],
  cost: [
    "Pricing is scoped by current conditions, selections, and access. We share a low/high range before contract and refresh it after design choices.",
    "Budgets flex with structural findings and material tiers. We publish allowances early so you can steer spend before we mobilize.",
  ],
  timeline: [
    "Most {service} timelines run in planned phases: prep, demo, rough-in, inspections, finishes, and walk-through, with buffer for city response times.",
    "We sequence trades to reduce downtime, and schedule inspections early to absorb the usual LA County review windows without stopping the job.",
  ],
  permits: [
    "LA County and {city} permitting can add review cycles; we submit clean packets, coordinate corrections, and keep you updated on any holds.",
    "We follow local energy, seismic, and fire requirements for {service}. Permit timing varies; we set expectations and do pre-checks to prevent rework.",
  ],
  how_to_choose: [
    "Choose a partner with verifiable references, transparent change orders, and site supervision that actually shows up in {city}-we make that standard.",
    "Look for a team that documents selections, tracks RFIs, and shows schedule ownership. That's how we keep momentum in {city} homes.",
  ],
  our_process: [
    "We map milestones, lock procurement, prep neighbors, and keep you in the loop with weekly reports, photos, and clear next steps.",
    "Expect upfront discovery, clear cost controls, field supervision, and tidy sites. Our crews protect floors, manage debris, and respect your block.",
  ],
  warranties: [
    "We stand behind labor with documented warranties and share manufacturer coverage for installed systems without overstating guarantees.",
    "Post-completion, we provide close-out docs, care guidance, and support windows so you know who to call if anything needs tuning.",
  ],
  materials: [
    "We recommend materials suited to coastal humidity and valley heat alike, sourcing lead-time friendly options to avoid schedule drift.",
    "Spec choices factor maintenance and availability. We align aesthetics with durable, code-compliant assemblies for {service} in {city}.",
  ],
  common_mistakes: [
    "Common pitfalls include skipping exploratory demo, underestimating panel capacity, or ignoring HOA notice windows-avoid them with a disciplined plan.",
    "Rushing permits, selecting long-lead fixtures late, or missing shear wall impacts can add weeks. We sequence decisions to dodge those delays.",
  ],
};

function paragraph(section: string, city: string, service: string, seed: number, sentences = 4) {
  const base = pick(sentenceBanks[section], seed + sentences);
  const extra = pick(sentenceBanks[section], seed + sentences + 2);
  const filler = [
    `Clients in ${city} often pair ${service} with envelope upgrades, so we align scopes to keep inspections efficient and avoid rework.`,
    `We plan site logistics around parking, hauling, and quiet hours so ${service} work fits into ${city}'s neighborhood rhythms.`,
    `Coordination with utilities, inspectors, and neighbors stays transparent; you get clear owners, dates, and next actions each week.`,
    `Cost transparency matters: we flag allowance-driven swings early and never promise results beyond what conditions allow.`,
  ];
  const items = [base, extra, ...filler].slice(0, sentences);
  return items
    .map((s) =>
      s
        .replace(/{city}/g, city)
        .replace(/{service}/g, service)
    )
    .join(" ");
}

export type GeneratedContent = {
  h1: string;
  sections: { id: string; title: string; body: string; bullets?: string[] }[];
  faqs: { q: string; a: string }[];
  ctas: { label: string; href: string }[];
  schemaJsonLd: any;
  seo: { title: string; description: string; canonical: string; ogTitle: string; ogDescription: string };
};

export function generateSeoPageContent(
  city: { name: string; slug: string },
  service: { name: string; slug: string; category?: string },
  options?: { slugPath?: string }
): GeneratedContent {
  const seed = hashSeed(`${city.slug}-${service.slug}`);
  const sectionTitle = (id: string) =>
    pick(
      [
        `${service.name} ${id.replace(/_/g, " ")}`,
        `${id.replace(/_/g, " ")}`,
        `${city.name} ${service.name}: ${id.replace(/_/g, " ")}`,
      ],
      seed + id.length
    );

  const optionalIds = ["warranties", "materials", "common_mistakes"];
  const selectedOptionals = optionalIds.slice(0, 2 + (seed % 2));
  const ids = [...REQUIRED_SECTION_IDS, ...selectedOptionals];

  const sections = ids.map((id, idx) => ({
    id,
    title: sectionTitle(id),
    body: paragraph(id, city.name, service.name, seed + idx, 6),
    bullets:
      id === "what_includes"
        ? [
            `Dedicated project lead in ${city.name}`,
            `Trades scheduled in tight windows to reduce downtime`,
            `Transparent change tracking and photo updates`,
          ]
        : id === "cost"
        ? [
            "Ranges shared before contract and refined after selections",
            "No absolute guarantees; discoveries can adjust scope",
            "Labor and materials billed per approved milestones",
          ]
        : undefined,
  }));

  const faqTemplates = [
    `How long does ${service.name.toLowerCase()} take in ${city.name}?`,
    `Do I need permits for ${service.name.toLowerCase()} in ${city.name}?`,
    `Can you work with my designer or architect in ${city.name}?`,
    "How do you handle noise, debris, and neighbor notices?",
    `What drives price changes during ${service.name.toLowerCase()}?`,
    "Do you help with material sourcing and lead times?",
    `How do inspections work for projects in ${city.name}?`,
    "What does communication look like week to week?",
    `Can you start quickly on a ${service.name.toLowerCase()} project?`,
    "How do you prevent delays on LA County projects?",
  ];

  const faqs = faqTemplates.slice(0, 6 + (seed % 4)).map((q, i) => ({
    q,
    a: paragraph("overview", city.name, service.name, seed + i + 20, 3),
  }));

  const slugPath = options?.slugPath || `/la-county/${city.slug}/${service.slug}`;
  const h1 = `${service.name} in ${city.name}`;
  const description = `Trusted ${service.name.toLowerCase()} specialists serving ${city.name} with transparent pricing, clean execution, and LA County permitting expertise.`.slice(
    0,
    170
  );
  const title = `${city.name} ${service.name} | LA County Pros`;

  const schemaJsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: `${service.name} in ${city.name}`,
    areaServed: {
      "@type": "City",
      name: city.name,
      address: { addressLocality: city.name, addressRegion: "CA", addressCountry: "US" },
    },
    serviceType: service.name,
    category: service.category || "Home Services",
    url: `${SITE_URL}${slugPath}`,
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      description: "Estimates vary; inspection findings and selections can adjust price.",
    },
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: `${service.name} options in ${city.name}`,
      itemListElement: sections.slice(0, 4).map((s) => ({ "@type": "Offer", itemOffered: s.title })),
    },
    provider: {
      "@type": "LocalBusiness",
      name: "LA County Pros",
      address: {
        "@type": "PostalAddress",
        addressRegion: "CA",
        addressCountry: "US",
        addressLocality: city.name,
      },
    },
  };

  return {
    h1,
    sections,
    faqs,
    ctas: [
      { label: "Start an estimate", href: `/estimate?city=${city.slug}&service=${service.slug}` },
      { label: "Call back request", href: "/estimate" },
    ],
    schemaJsonLd,
    seo: {
      title,
      description,
      canonical: `${SITE_URL}${slugPath}`,
      ogTitle: title,
      ogDescription: description,
    },
  };
}

export function computeSlugPath(citySlug: string, serviceSlug: string) {
  return `/la-county/${slugify(citySlug)}/${slugify(serviceSlug)}`;
}



