import { notFound } from "next/navigation";
import { canUseAdmin, getAdminDb } from "@/lib/firebase-admin";
import { getPublicDb } from "@/lib/firestore-public";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { getSiteSettings } from "@/lib/settings";
import { resolveBaseUrl } from "@/lib/env";
import { headers } from "next/headers";
import { serializeFirestore } from "@/lib/serialize-firestore";
import { clampLanding } from "@/lib/contracts/landing";
import { fetchPublishedTemplate } from "@/lib/templates/fetchTemplate";
import { renderTemplate } from "@/templates/renderTemplate";
import { applyTemplate } from "@/lib/seo";

async function fetchPage(city: string, service: string) {
  const slugPath = `/la-county/${city}/${service}`;
  if (canUseAdmin()) {
    const snap = await getAdminDb()
      .collection("pages")
      .where("slugPath", "==", slugPath)
      .where("status", "==", "published")
      .limit(1)
      .get();
    if (snap.empty) return null;
    const data = snap.docs[0].data();
    return { id: snap.docs[0].id, ...serializeFirestore(data) };
  }
  const db = getPublicDb();
  const q = query(
    collection(db, "pages"),
    where("slugPath", "==", slugPath),
    where("status", "==", "published"),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const data = snap.docs[0].data() as any;
  return { id: snap.docs[0].id, ...serializeFirestore(data) };
}

export default async function SeoPage({ params }: { params: Promise<{ city: string; service: string }> }) {
  const { city, service } = await params;
  const page = await fetchPage(city, service);
  if (!page) return notFound();

  const template = await fetchPublishedTemplate();
  return renderTemplate(template, page);
}

export async function generateMetadata({ params }: { params: Promise<{ city: string; service: string }> }) {
  const { city, service } = await params;
  const page = await fetchPage(city, service);
  if (!page) return {};
  const serviceName = page.service?.name || page.service?.slug || service;
  const cityName = page.city?.name || page.city?.slug || city;
  const content = clampLanding({
    service: serviceName,
    city: cityName,
    hero: {
      headline: page.content?.h1,
      subheadline: page.seo?.description,
      bullets: page.content?.sections?.[0]?.bullets,
    },
    faq: page.content?.faqs,
    seo: {
      title: page.seo?.title,
      description: page.seo?.description,
      canonicalPath: page.seo?.canonical || page.slugPath || `/la-county/${city}/${service}`,
    },
  });
  const settings = await getSiteSettings();
  const hdrs = await headers();
  const base = resolveBaseUrl(hdrs, settings.seo.canonicalMode === "siteUrl" ? settings.siteUrl : undefined);
  const vars = {
    service: serviceName,
    place: cityName,
    zip: page.zip || "",
    county: page.countyName || "Los Angeles County",
    siteName: settings.siteName,
  };
  const title = content.seo.title || applyTemplate(settings.seo.titleTemplate, vars);
  const description = content.seo.description || applyTemplate(settings.seo.metaDescriptionTemplate, vars);
  const canonicalPath = content.seo.canonicalPath || page.slugPath || `/la-county/${city}/${service}`;
  const canonical =
    canonicalPath.startsWith("http") ? canonicalPath : `${base}${canonicalPath}`;
  const robots =
    !settings.seo.allowIndexing || settings.seo.robotsPolicy === "noindex" || (settings.seo.noindexUnpublished && page.status !== "published")
      ? {
          index: false,
          follow: false,
        }
      : undefined;
  return {
    title,
    description,
    alternates: { canonical },
    robots,
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: settings.siteName || undefined,
      images: settings.seo.defaultOgImageUrl ? [settings.seo.defaultOgImageUrl] : undefined,
    },
  };
}
