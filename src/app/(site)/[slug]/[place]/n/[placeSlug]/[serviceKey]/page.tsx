import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getAdminDb } from "@/lib/firebase-admin";
import { getSiteSettings } from "@/lib/settings";
import { resolveBaseUrl } from "@/lib/env";
import { applyTemplate } from "@/lib/seo";
import { fetchPublishedTemplate } from "@/lib/templates/fetchTemplate";
import { renderTemplate } from "@/templates/renderTemplate";

export default async function ZipPlaceServicePage({
  params,
}: {
  params: Promise<{ slug: string; place: string; placeSlug: string; serviceKey: string }>;
}) {
  const { slug: countySlug, place, placeSlug, serviceKey } = await params;

  const zipRe = /^\d{5}$/;
  const slugRe = /^[a-z0-9-]+$/;
  if (!zipRe.test(place)) return notFound();
  if (!countySlug || !placeSlug || !serviceKey) return notFound();
  if (!slugRe.test(countySlug) || !slugRe.test(placeSlug) || !slugRe.test(serviceKey)) return notFound();
  const zip = place;

  const slugPath = `/${countySlug}/${zip}/n/${placeSlug}/${serviceKey}`;
  const docId = `${countySlug}__${zip}__${placeSlug}__${serviceKey}`;

  const db = getAdminDb();
  const snap = await db.collection("pages").doc(docId).get();
  if (!snap.exists) return notFound();

  const page = snap.data() as any;
  if (page?.status !== "published") return notFound();

  const template = await fetchPublishedTemplate();

  return renderTemplate(template, { ...page, slugPath });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; place: string; placeSlug: string; serviceKey: string }>;
}) {
  const { slug: countySlug, place, placeSlug, serviceKey } = await params;
  const zipRe = /^\d{5}$/;
  const slugRe = /^[a-z0-9-]+$/;
  if (!zipRe.test(place)) return {};
  if (!slugRe.test(countySlug) || !slugRe.test(placeSlug) || !slugRe.test(serviceKey)) return {};
  const zip = place;
  const slugPath = `/${countySlug}/${zip}/n/${placeSlug}/${serviceKey}`;
  const docId = `${countySlug}__${zip}__${placeSlug}__${serviceKey}`;

  const snap = await getAdminDb().collection("pages").doc(docId).get();
  if (!snap.exists) return {};
  const page = snap.data() as any;
  if (page?.status !== "published") return {};

  const settings = await getSiteSettings();
  const hdrs = await headers();
  const base = resolveBaseUrl(hdrs, settings.seo.canonicalMode === "siteUrl" ? settings.siteUrl : undefined);

  const serviceName = page.serviceName || page.service?.name || serviceKey;
  const placeName = page.placeName || page.place?.name || page.cityName || placeSlug;
  const countyName = page.countyName || countySlug;

  const vars = {
    service: serviceName,
    place: placeName,
    zip,
    county: countyName,
    siteName: settings.siteName,
  };

  const title = page.seo?.title || applyTemplate(settings.seo.titleTemplate, vars);
  const description = page.seo?.description || applyTemplate(settings.seo.metaDescriptionTemplate, vars);

  const canonical =
    settings.seo.canonicalMode === "siteUrl"
      ? `${base}${slugPath}`
      : `${resolveBaseUrl(hdrs)}${slugPath}`;

  const robots =
    !settings.seo.allowIndexing || settings.seo.robotsPolicy === "noindex"
      ? { index: false, follow: false }
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
