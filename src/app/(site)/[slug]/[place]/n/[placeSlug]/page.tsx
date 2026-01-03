import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getAdminDb } from "@/lib/firebase-admin";
import { getSiteSettings } from "@/lib/settings";
import { resolveBaseUrl } from "@/lib/env";
import { applyTemplate } from "@/lib/seo";
import { urlNeighborhoodService } from "@/lib/urls";

type PageParams = { slug: string; place: string; placeSlug: string };
const slugRe = /^[a-z0-9-]+$/;
const zipRe = /^\d{5}$/;

export default async function NeighborhoodLandingPage({ params }: { params: Promise<PageParams> }) {
  const { slug: countySlug, place, placeSlug } = await params;
  if (!countySlug || !place || !placeSlug) return notFound();
  const isZip = zipRe.test(place);
  if (!slugRe.test(countySlug) || !slugRe.test(placeSlug) || (!isZip && !slugRe.test(place))) {
    return notFound();
  }

  const baseQuery = getAdminDb()
    .collection("pages")
    .where("countySlug", "==", countySlug)
    .where("placeSlug", "==", placeSlug)
    .where("status", "==", "published");

  const snap = await (isZip
    ? baseQuery.where("zip", "==", place).limit(100).get()
    : baseQuery.where("citySlug", "==", place).limit(100).get());

  if (snap.empty) return notFound();

  const services = snap.docs
    .map((d) => d.data() as any)
    .map((p) => ({
      key: p.service?.key || p.serviceKey || p.service?.slug || "",
      name: p.service?.name || p.serviceName || p.service?.slug || "Service",
    }))
    .filter((s) => s.key)
    .filter((s, idx, arr) => arr.findIndex((x) => x.key === s.key) === idx);

  const first = snap.docs[0].data() as any;
  const placeName = first.placeName || first.place?.name || first.cityName || placeSlug;

  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-semibold text-slate-900">
        Services in {placeName}
      </h1>
      <p className="mt-2 text-slate-600">
        Browse popular services available in {placeName}.
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {services.map((svc) => (
          <a
            key={svc.key}
            href={urlNeighborhoodService(countySlug, place, placeSlug, svc.key)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 hover:border-slate-300"
          >
            {svc.name}
          </a>
        ))}
      </div>
    </main>
  );
}

export async function generateMetadata({ params }: { params: Promise<PageParams> }) {
  const { slug: countySlug, place, placeSlug } = await params;
  if (!countySlug || !place || !placeSlug) return {};
  const isZip = zipRe.test(place);
  if (!slugRe.test(countySlug) || !slugRe.test(placeSlug) || (!isZip && !slugRe.test(place))) {
    return {};
  }

  const baseQuery = getAdminDb()
    .collection("pages")
    .where("countySlug", "==", countySlug)
    .where("placeSlug", "==", placeSlug)
    .where("status", "==", "published");

  const snap = await (isZip
    ? baseQuery.where("zip", "==", place).limit(1).get()
    : baseQuery.where("citySlug", "==", place).limit(1).get());

  if (snap.empty) return {};
  const data = snap.docs[0].data() as any;

  const settings = await getSiteSettings();
  const hdrs = await headers();
  const base = resolveBaseUrl(hdrs, settings.seo.canonicalMode === "siteUrl" ? settings.siteUrl : undefined);

  const placeName = data.placeName || data.place?.name || data.cityName || placeSlug;
  const vars = {
    service: "Home Services",
    place: placeName,
    zip: data.zip || (isZip ? place : ""),
    county: data.countyName || countySlug,
    siteName: settings.siteName,
  };

  const title = applyTemplate(settings.seo.titleTemplate, vars);
  const description = applyTemplate(settings.seo.metaDescriptionTemplate, vars);
  const canonical = `${base}/${countySlug}/${place}/n/${placeSlug}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: settings.siteName || undefined,
      images: settings.seo.defaultOgImageUrl ? [settings.seo.defaultOgImageUrl] : undefined,
    },
  };
}
