import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getAdminDb } from "@/lib/firebase-admin";
import { getSiteSettings } from "@/lib/settings";
import { resolveBaseUrl } from "@/lib/env";
import { applyTemplate } from "@/lib/seo";
import { fetchPublishedTemplate } from "@/lib/templates/fetchTemplate";
import { renderTemplate } from "@/templates/renderTemplate";

type PageParams = { slug: string; place: string; serviceKey: string };
const slugRe = /^[a-z0-9-]+$/;
const zipRe = /^\d{5}$/;

export default async function CityServicePage({ params }: { params: Promise<PageParams> }) {
  const { slug: countySlug, place, serviceKey } = await params;
  if (!countySlug || !place || !serviceKey) return notFound();
  const isZip = zipRe.test(place);
  if (!slugRe.test(countySlug) || (!isZip && !slugRe.test(place)) || !slugRe.test(serviceKey)) {
    return notFound();
  }

  const baseQuery = getAdminDb()
    .collection("pages")
    .where("countySlug", "==", countySlug)
    .where("service.key", "==", serviceKey);

  const snap = await (isZip
    ? baseQuery.where("zip", "==", place).limit(1).get()
    : baseQuery.where("citySlug", "==", place).limit(1).get());

  if (snap.empty) return notFound();
  const page = snap.docs[0].data() as any;
  if (page?.status !== "published") return notFound();

  const template = await fetchPublishedTemplate();
  return renderTemplate(template, { ...page, slugPath: page.slugPath || `/${countySlug}/${place}/s/${serviceKey}` });
}

export async function generateMetadata({ params }: { params: Promise<PageParams> }) {
  const { slug: countySlug, place, serviceKey } = await params;
  if (!countySlug || !place || !serviceKey) return {};
  const isZip = zipRe.test(place);
  if (!slugRe.test(countySlug) || (!isZip && !slugRe.test(place)) || !slugRe.test(serviceKey)) {
    return {};
  }

  const baseQuery = getAdminDb()
    .collection("pages")
    .where("countySlug", "==", countySlug)
    .where("service.key", "==", serviceKey);

  const snap = await (isZip
    ? baseQuery.where("zip", "==", place).limit(1).get()
    : baseQuery.where("citySlug", "==", place).limit(1).get());
  if (snap.empty) return {};
  const page = snap.docs[0].data() as any;
  if (page?.status !== "published") return {};

  const settings = await getSiteSettings();
  const hdrs = await headers();
  const base = resolveBaseUrl(hdrs, settings.seo.canonicalMode === "siteUrl" ? settings.siteUrl : undefined);

  const serviceName = page.serviceName || page.service?.name || serviceKey;
  const cityName = page.cityName || page.city?.name || place;
  const vars = {
    service: serviceName,
    place: cityName,
    zip: page.zip || (isZip ? place : ""),
    county: page.countyName || countySlug,
    siteName: settings.siteName,
  };
  const title = page.seo?.title || applyTemplate(settings.seo.titleTemplate, vars);
  const description = page.seo?.description || applyTemplate(settings.seo.metaDescriptionTemplate, vars);
  const canonical = `${base}/${countySlug}/${place}/s/${serviceKey}`;

  return {
    title,
    description,
    alternates: { canonical },
    robots:
      !settings.seo.allowIndexing || settings.seo.robotsPolicy === "noindex"
        ? { index: false, follow: false }
        : undefined,
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: settings.siteName || undefined,
      images: settings.seo.defaultOgImageUrl ? [settings.seo.defaultOgImageUrl] : undefined,
    },
  };
}
