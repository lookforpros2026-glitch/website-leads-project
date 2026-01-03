import type { Timestamp } from "firebase-admin/firestore";

export type PageStatus = "draft" | "review" | "published" | "archived";

export type PageSEO = {
  title: string;
  description: string;
  canonical?: string;
  ogTitle?: string;
  ogDescription?: string;
};

export type PageContentSection = {
  id: string;
  title: string;
  body: string;
  bullets?: string[];
};

export type PageContentFaq = { q: string; a: string };

export type PageContent = {
  h1?: string;
  sections: PageContentSection[];
  faqs?: PageContentFaq[];
  ctas?: Array<{ label: string; href: string }>;
  schemaJsonLd?: any;
};

export type PageQuality = {
  wordCount?: number;
  duplicationScore?: number;
  requiredSectionsOk?: boolean;
  warnings?: string[];
  lastQaAt?: Timestamp;
};

export type PageDoc = {
  market: string;
  city: { slug: string; name: string; locationId?: string };
  service: { slug: string; name: string; serviceId?: string; category?: string };
  slugPath: string;
  status: PageStatus;
  seo?: PageSEO;
  content?: PageContent;
  quality?: PageQuality;
  generation?: {
    version?: number;
    lastGeneratedAt?: Timestamp;
    generator?: string;
  };
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  publishedAt?: Timestamp | null;
};

export type PageDocSerialized = Omit<PageDoc, "createdAt" | "updatedAt" | "publishedAt" | "quality" | "generation"> & {
  createdAtMs: number | null;
  updatedAtMs: number | null;
  publishedAtMs: number | null;
  quality?: Omit<PageQuality, "lastQaAt"> & { lastQaAtMs?: number | null };
  generation?: PageDoc["generation"];
};
