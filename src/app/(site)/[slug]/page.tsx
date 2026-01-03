import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { getAdminDb } from "@/lib/firebase-admin";
import { getSiteSettings } from "@/lib/settings";
import { resolveBaseUrl } from "@/lib/env";
import { applyTemplate } from "@/lib/seo";
import { fetchPublishedTemplate } from "@/lib/templates/fetchTemplate";
import { renderTemplate } from "@/templates/renderTemplate";
import { buildCanonicalPath } from "@/lib/page-paths";

export default async function SlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const RESERVED = new Set(["favicon.ico", "robots.txt", "sitemap.xml", "sitemap-index.xml", "manifest.json"]);
  const { slug } = await params;
  const decoded = decodeURIComponent(slug || "");

  if (decoded.includes("__")) {
    const parts = decoded.split("__").filter(Boolean);
    if (parts.length !== 4) return notFound();
    const [county, place, placeSlug, serviceKey] = parts;
    if (!county || !place || !placeSlug || !serviceKey) return notFound();
    const slugRe = /^[a-z0-9-]+$/;
    const zipRe = /^\d{5}$/;
    const isZip = zipRe.test(place);
    if (!slugRe.test(county) || !slugRe.test(placeSlug) || !slugRe.test(serviceKey)) return notFound();
    if (!isZip && !slugRe.test(place)) return notFound();
    redirect(`/${county}/${place}/n/${placeSlug}/${serviceKey}`);
  }

  if (RESERVED.has(decoded)) return notFound();

  const s = decoded.toLowerCase().trim();

  if (!s) return notFound();

  // DOC-ID based lookup (canonical)
  const snap = await getAdminDb().collection("pages").doc(s).get();

  if (!snap.exists) {
    return notFound();
  }

  const data = snap.data() as any;

  // enforce published-only
  if (data.status !== "published") {
    return notFound();
  }

  const cityName =
    typeof data.city === "string"
      ? data.city
      : data.city?.name ?? data.city?.slug ?? "";

  const serviceName =
    typeof data.service === "string"
      ? data.service
      : data.service?.name ?? data.service?.slug ?? "";

  const template = await fetchPublishedTemplate();
  return renderTemplate(template, { ...data, slug: s });
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const decoded = decodeURIComponent(slug || "");
  if (!decoded) return {};

  const snap = await getAdminDb().collection("pages").doc(decoded).get();
  if (!snap.exists) return {};
  const data = snap.data() as any;
  if (data.status !== "published") return {};

  const settings = await getSiteSettings();
  const hdrs = await headers();
  const base = resolveBaseUrl(hdrs, settings.seo.canonicalMode === "siteUrl" ? settings.siteUrl : undefined);

  const serviceName = data.serviceName || data.service?.name || data.service?.slug || "";
  const placeName = data.placeName || data.cityName || data.city?.name || data.city?.slug || "";
  const zip = data.zip || "";
  const countyName = data.countyName || data.countySlug || "";

  const vars = {
    service: serviceName,
    place: placeName,
    zip: zip,
    county: countyName,
    siteName: settings.siteName,
  };

  const title = data.seo?.title || applyTemplate(settings.seo.titleTemplate, vars);
  const description = data.seo?.description || applyTemplate(settings.seo.metaDescriptionTemplate, vars);
  const slugPath = buildCanonicalPath(data) || `/${decoded}`;

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
