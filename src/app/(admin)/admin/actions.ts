"use server";

import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/auth.app.server";
import { slugify } from "@/lib/slug";
import { computeSlugPath, generateSeoPageContent } from "@/lib/generator";
import { evaluateQuality, runQa } from "@/lib/qa";
import { saveSiteSettings } from "@/lib/settings";
import { DEFAULT_SITE_CONFIG } from "@/lib/settings-types";

function deepStripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .filter((v) => v !== undefined)
      .map((v) => deepStripUndefined(v)) as any;
  }
  if (value && typeof value === "object") {
    const out: any = {};
    for (const [k, v] of Object.entries(value as any)) {
      if (v === undefined) continue;
      out[k] = deepStripUndefined(v);
    }
    return out;
  }
  return value;
}

function defaultLocationNotes(name: string) {
  return {
    housing: `${name} mixes single-family homes and multi-unit buildings.`,
    permits: `Permits run through local ${name} or county offices; plan for review time.`,
    common: `Common project needs include upgrades to aging systems and layout tweaks for modern living.`,
  };
}

async function generatePageData(location: { id: string; name: string; slug: string }, service: { id: string; name: string; slug: string; category: string }) {
  const generated = generateSeoPageContent({ name: location.name, slug: location.slug }, { name: service.name, slug: service.slug, category: service.category });
  return {
    market: "la-county",
    city: { slug: location.slug, name: location.name, locationId: location.id },
    service: { slug: service.slug, name: service.name, serviceId: service.id, category: service.category },
    slugPath: computeSlugPath(location.slug, service.slug),
    status: "draft" as const,
    seo: generated.seo,
    content: {
      h1: generated.h1,
      sections: generated.sections,
      faqs: generated.faqs,
      ctas: generated.ctas,
      schemaJsonLd: generated.schemaJsonLd,
    },
    quality: {
      wordCount: 0,
      duplicationScore: 0,
      requiredSectionsOk: false,
      warnings: [],
    },
    generation: {
      version: 1,
      lastGeneratedAt: FieldValue.serverTimestamp(),
      generator: "codex-template-v1",
    },
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    publishedAt: null,
  };
}

export async function createLocation(formData: FormData) {
  await requireAdmin();
  const schema = z.object({ name: z.string().min(2), type: z.enum(["city", "neighborhood", "area"]) });
  const parsed = schema.parse({
    name: formData.get("name"),
    type: formData.get("type"),
  });
  const db = getAdminDb();
  const slug = slugify(parsed.name);
  const ref = db.collection("geo_locations").doc(slug);
  await ref.set({
    slug,
    name: parsed.name,
    county: "Los Angeles County",
    state: "CA",
    type: parsed.type,
    notes: defaultLocationNotes(parsed.name),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function updateLocation(formData: FormData) {
  await requireAdmin();
  const schema = z.object({
    slug: z.string(),
    name: z.string().min(2),
    type: z.enum(["city", "neighborhood", "area"]),
    housing: z.string().optional(),
    permits: z.string().optional(),
    common: z.string().optional(),
  });
  const parsed = schema.parse({
    slug: formData.get("slug"),
    name: formData.get("name"),
    type: formData.get("type"),
    housing: formData.get("housing") || "",
    permits: formData.get("permits") || "",
    common: formData.get("common") || "",
  });
  const db = getAdminDb();
  await db
    .collection("geo_locations")
    .doc(parsed.slug)
    .set(
      {
        slug: parsed.slug,
        name: parsed.name,
        type: parsed.type,
        notes: { housing: parsed.housing, permits: parsed.permits, common: parsed.common },
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
}

export async function deleteLocation(slug: string) {
  await requireAdmin();
  const db = getAdminDb();
  await db.collection("geo_locations").doc(slug).delete();
}

export async function createService(formData: FormData) {
  await requireAdmin();
  const schema = z.object({ name: z.string().min(2), category: z.string().min(2), priceLow: z.coerce.number(), priceHigh: z.coerce.number(), unit: z.enum(["project", "job"]) });
  const parsed = schema.parse({
    name: formData.get("name"),
    category: formData.get("category"),
    priceLow: formData.get("priceLow"),
    priceHigh: formData.get("priceHigh"),
    unit: formData.get("unit"),
  });
  const slug = slugify(parsed.name);
  const db = getAdminDb();
  const ref = db.collection("tax_services").doc(slug);
  await ref.set({
    slug,
    name: parsed.name,
    category: parsed.category,
    price: { low: parsed.priceLow, high: parsed.priceHigh, unit: parsed.unit },
    synonyms: [],
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function updateService(formData: FormData) {
  await requireAdmin();
  const schema = z.object({
    slug: z.string(),
    name: z.string().min(2),
    category: z.string().min(2),
    priceLow: z.coerce.number(),
    priceHigh: z.coerce.number(),
    unit: z.enum(["project", "job"]),
  });
  const parsed = schema.parse({
    slug: formData.get("slug"),
    name: formData.get("name"),
    category: formData.get("category"),
    priceLow: formData.get("priceLow"),
    priceHigh: formData.get("priceHigh"),
    unit: formData.get("unit"),
  });
  const db = getAdminDb();
  await db
    .collection("tax_services")
    .doc(parsed.slug)
    .set(
      {
        slug: parsed.slug,
        name: parsed.name,
        category: parsed.category,
        price: { low: parsed.priceLow, high: parsed.priceHigh, unit: parsed.unit },
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
}

export async function deleteService(slug: string) {
  await requireAdmin();
  const db = getAdminDb();
  await db.collection("tax_services").doc(slug).delete();
}

export async function createPage(formData: FormData) {
  await requireAdmin();
  const schema = z.object({
    citySlug: z.string(),
    serviceSlug: z.string(),
  });
  const parsed = schema.parse({
    citySlug: formData.get("citySlug"),
    serviceSlug: formData.get("serviceSlug"),
  });
  const db = getAdminDb();
  const locSnap = await db.collection("geo_locations").doc(parsed.citySlug).get();
  const svcSnap = await db.collection("tax_services").doc(parsed.serviceSlug).get();
  if (!locSnap.exists || !svcSnap.exists) throw new Error("Invalid city or service");
  const location = { id: locSnap.id, ...(locSnap.data() as any) };
  const service = { id: svcSnap.id, ...(svcSnap.data() as any) };
  const docId = `${location.slug}__${service.slug}`;
  const existing = await db.collection("pages").doc(docId).get();
  if (existing.exists) return { id: existing.id };
  const data = await generatePageData(location, service);
  if (data?.content?.sections?.length) {
    data.content.sections = data.content.sections.map((s: any) => ({
      ...s,
      bullets: Array.isArray(s?.bullets)
        ? s.bullets.filter((b: any) => typeof b === "string" && b.trim().length > 0)
        : [],
    }));
  }
  const dataClean = deepStripUndefined(data);
  const ref = db.collection("pages").doc(docId);
  await ref.set(dataClean);
  await runQa(ref.id);
  revalidatePath("/admin/pages");
  return { id: ref.id };
}

export async function generatePage(pageId: string) {
  await requireAdmin();
  const db = getAdminDb();
  const ref = db.collection("pages").doc(pageId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Page not found");
  const page = snap.data() as any;
  const generated = generateSeoPageContent(page.city, page.service);
  await ref.update({
    seo: generated.seo,
    content: {
      h1: generated.h1,
      sections: generated.sections,
      faqs: generated.faqs,
      ctas: generated.ctas,
      schemaJsonLd: generated.schemaJsonLd,
    },
    generation: {
      version: (page.generation?.version || 0) + 1,
      lastGeneratedAt: FieldValue.serverTimestamp(),
      generator: "codex-template-v1",
    },
    updatedAt: FieldValue.serverTimestamp(),
  });
  const result = await runQa(pageId);
  revalidatePath(`/admin/pages/${pageId}`);
  return result;
}

export async function savePage(formData: FormData) {
  await requireAdmin();
  const schema = z.object({
    pageId: z.string(),
    title: z.string(),
    description: z.string(),
    canonical: z.string(),
    ogTitle: z.string(),
    ogDescription: z.string(),
    h1: z.string(),
  });
  const parsed = schema.parse({
    pageId: formData.get("pageId"),
    title: formData.get("title"),
    description: formData.get("description"),
    canonical: formData.get("canonical"),
    ogTitle: formData.get("ogTitle"),
    ogDescription: formData.get("ogDescription"),
    h1: formData.get("h1"),
  });
  const db = getAdminDb();
  const ref = db.collection("pages").doc(parsed.pageId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Page not found");
  await ref.update({
    seo: {
      title: parsed.title,
      description: parsed.description,
      canonical: parsed.canonical,
      ogTitle: parsed.ogTitle,
      ogDescription: parsed.ogDescription,
    },
    "content.h1": parsed.h1,
    updatedAt: FieldValue.serverTimestamp(),
  });
  revalidatePath(`/admin/pages/${parsed.pageId}`);
}

export async function publishPages(pageIds: string[]) {
  await requireAdmin();
  const db = getAdminDb();
  for (const id of pageIds) {
    const ref = db.collection("pages").doc(id);
    const snap = await ref.get();
    if (!snap.exists) continue;
    await ref.update({ status: "published", publishedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  }
  revalidatePath("/admin/pages");
}

export async function unpublishPage(pageId: string) {
  await requireAdmin();
  const db = getAdminDb();
  const ref = db.collection("pages").doc(pageId);
  await ref.update({ status: "review", updatedAt: FieldValue.serverTimestamp(), publishedAt: null });
  revalidatePath(`/admin/pages/${pageId}`);
}

export async function archivePages(pageIds: string[]) {
  await requireAdmin();
  const db = getAdminDb();
  for (const id of pageIds) {
    const ref = db.collection("pages").doc(id);
    await ref.update({ status: "archived", updatedAt: FieldValue.serverTimestamp() });
  }
  revalidatePath("/admin/pages");
}

export async function runQaForPages(pageIds: string[]) {
  await requireAdmin();
  for (const id of pageIds) {
    await runQa(id);
  }
  revalidatePath("/admin/pages");
}

export async function bulkGeneratePages(pageIds: string[]) {
  await requireAdmin();
  for (const id of pageIds) {
    await generatePage(id);
  }
  revalidatePath("/admin/pages");
}

export async function regenerateSection(pageId: string, sectionId: string) {
  await requireAdmin();
  const db = getAdminDb();
  const ref = db.collection("pages").doc(pageId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Page not found");
  const page = snap.data() as any;
  const generated = generateSeoPageContent(page.city, page.service);
  const target = generated.sections.find((s) => s.id === sectionId);
  if (!target) throw new Error("Section not found in template");
  const sections = (page.content?.sections || []).map((s: any) => (s.id === sectionId ? target : s));
  await ref.update({
    "content.sections": sections,
    updatedAt: FieldValue.serverTimestamp(),
  });
  await runQa(pageId);
  revalidatePath(`/admin/pages/${pageId}`);
}

export async function saveSiteSettingsAction(formData: FormData) {
  await requireAdmin();
  const schema = z.object({
    siteName: z.string().min(2),
    siteUrl: z.string().optional().nullable(),
    defaultMarket: z.string().min(2),
    sitemapLimit: z.coerce.number().min(1),
    enableIndexing: z.enum(["on"]).optional(),
  });
  const parsed = schema.parse({
    siteName: formData.get("siteName"),
    siteUrl: formData.get("siteUrl"),
    defaultMarket: formData.get("defaultMarket"),
    sitemapLimit: formData.get("sitemapLimit"),
    enableIndexing: formData.get("enableIndexing"),
  });
  await saveSiteSettings({
    ...DEFAULT_SITE_CONFIG,
    siteName: parsed.siteName,
    siteUrl: parsed.siteUrl || "",
    defaultMarket: parsed.defaultMarket,
    seo: {
      ...DEFAULT_SITE_CONFIG.seo,
      sitemapLimit: parsed.sitemapLimit,
      allowIndexing: !!parsed.enableIndexing,
      robotsPolicy: !!parsed.enableIndexing ? "index" : "noindex",
    },
  });
  revalidatePath("/admin/settings");
}
