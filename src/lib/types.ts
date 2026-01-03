export type AdminRole = "owner" | "editor";

export type GeoLocation = {
  id: string;
  slug: string;
  name: string;
  county: "Los Angeles County";
  state: "CA";
  type: "city" | "neighborhood" | "area";
  notes: { housing: string; permits: string; common: string };
  createdAt?: Date;
  updatedAt?: Date;
};

export type TaxService = {
  id: string;
  slug: string;
  name: string;
  category: string;
  price: { low: number; high: number; unit: "project" | "job" };
  synonyms: string[];
  createdAt?: Date;
  updatedAt?: Date;
};

export type {
  PageDoc as Page,
  PageContent,
  PageContentFaq,
  PageContentSection as PageSection,
  PageStatus,
  PageSEO,
  PageQuality,
} from "./contracts/page";

export type Job = {
  id: string;
  type: "seed_500" | "bulk_create" | "generate_page" | "qa_pages" | "regenerate_section";
  status: "queued" | "running" | "succeeded" | "failed";
  input: any;
  output: any;
  error?: { message?: string; stack?: string };
  createdAt?: Date;
  updatedAt?: Date;
};

export type Lead = {
  id: string;
  pageId?: string;
  citySlug?: string;
  serviceSlug?: string;
  name: string;
  phone: string;
  answers: any;
  createdAt?: Date;
};
