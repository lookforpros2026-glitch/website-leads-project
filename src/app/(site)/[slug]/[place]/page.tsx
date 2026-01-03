import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getAdminDb } from "@/lib/firebase-admin";
import { getSiteSettings } from "@/lib/settings";
import { resolveBaseUrl } from "@/lib/env";
import { applyTemplate } from "@/lib/seo";
import { buildCanonicalPath } from "@/lib/page-paths";

type PageParams = { slug: string; place: string };
const slugRe = /^[a-z0-9-]+$/;
const zipRe = /^\d{5}$/;

function buildFaqs(serviceName: string, zip: string) {
  return [
    { q: `Do you service ZIP ${zip}?`, a: `Yes, we serve ${zip} with ${serviceName.toLowerCase()} specialists.` },
    { q: "How fast can I get a quote?", a: "Most requests receive a response within one business day." },
    { q: "Is there a cost to request an estimate?", a: "No, requesting an estimate is free." },
  ];
}

export default async function ZipPage({ params }: { params: Promise<PageParams> }) {
  const { slug: countySlug, place } = await params;
  const isZip = zipRe.test(place);
  if (!isZip) return notFound();
  if (!countySlug) return notFound();
  if (!slugRe.test(countySlug)) return notFound();
  const zip = place;

  const snap = await getAdminDb()
    .collection("pages")
    .where("countySlug", "==", countySlug)
    .where("zip", "==", zip)
    .where("status", "==", "published")
    .limit(50)
    .get();

  if (snap.empty) return notFound();

  const services = snap.docs
    .map((d) => d.data() as any)
    .map((p) => {
      const key = p.service?.key || p.serviceKey || p.service?.slug || "";
      const name = p.service?.name || p.serviceName || p.service?.slug || "Service";
      const slugPath = buildCanonicalPath(p) || p.slugPath || "";
      return { key, name, slugPath };
    })
    .filter((s) => s.key && s.slugPath);

  const first = snap.docs[0].data() as any;
  const cityName = first.cityName || first.city?.name || "this area";
  const serviceName = services[0]?.name || "Home Services";
  const faqs = buildFaqs(serviceName, zip);

  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-semibold text-slate-900">{serviceName} in ZIP {zip}</h1>
      <p className="mt-2 text-slate-600">
        Explore popular services in {cityName} ({zip}). Choose a service to see details.
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {services.map((svc) => (
          <a
            key={svc.key}
            href={svc.slugPath}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 hover:border-slate-300"
          >
            {svc.name}
          </a>
        ))}
      </div>
      <div className="mt-10">
        <h2 className="text-xl font-semibold text-slate-900">FAQ</h2>
        <div className="mt-3 space-y-3">
          {faqs.map((f) => (
            <div key={f.q} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="font-semibold text-slate-900">{f.q}</div>
              <div className="mt-1 text-sm text-slate-600">{f.a}</div>
            </div>
          ))}
        </div>
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqs.map((faq) => ({
              "@type": "Question",
              name: faq.q,
              acceptedAnswer: { "@type": "Answer", text: faq.a },
            })),
          }),
        }}
      />
    </main>
  );
}

export async function generateMetadata({ params }: { params: Promise<PageParams> }) {
  const { slug: countySlug, place } = await params;
  if (!countySlug || !place) return {};
  if (!zipRe.test(place)) return {};
  if (!slugRe.test(countySlug)) return {};
  const zip = place;

  const snap = await getAdminDb()
    .collection("pages")
    .where("countySlug", "==", countySlug)
    .where("zip", "==", zip)
    .where("status", "==", "published")
    .limit(1)
    .get();
  if (snap.empty) return {};
  const data = snap.docs[0].data() as any;

  const settings = await getSiteSettings();
  const hdrs = await headers();
  const base = resolveBaseUrl(hdrs, settings.seo.canonicalMode === "siteUrl" ? settings.siteUrl : undefined);

  const serviceName = data.serviceName || data.service?.name || "Home Services";
  const cityName = data.cityName || data.city?.name || "your area";

  const vars = {
    service: serviceName,
    place: cityName,
    zip,
    county: data.countyName || countySlug,
    siteName: settings.siteName,
  };

  const title = applyTemplate(settings.seo.titleTemplate, vars);
  const description = applyTemplate(settings.seo.metaDescriptionTemplate, vars);
  const canonical = `${base}/${countySlug}/${zip}`;

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
