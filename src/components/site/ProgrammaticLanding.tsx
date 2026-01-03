import Link from "next/link";
import { ArrowRight, BadgeCheck, Clock, Headset, Scale, ShieldCheck, Wrench } from "lucide-react";

type CityObj = { locationId?: string; name?: string; slug?: string } | string | null | undefined;
type ServiceObj = { serviceId?: string; name?: string; slug?: string; category?: string } | string | null | undefined;
type NeighborhoodObj = { neighborhoodId?: string; name?: string; slug?: string } | string | null | undefined;
type CountyObj = { countyId?: string; name?: string; slug?: string } | string | null | undefined;

type CTA = { label: string; href: string };

type PageDoc = {
  slug: string;
  status?: string;
  locationLabel?: string;
  neighborhood?: NeighborhoodObj;
  county?: CountyObj;
  city?: CityObj;
  service?: ServiceObj;
  content?: {
    headline?: string;
    subheadline?: string;
    h1?: string;
    intro?: string;
    bullets?: string[];
    faqs?: { q: string; a: string }[];
    neighborhoods?: string[];
    gallery?: { src: string; alt?: string }[];
    ctas?: CTA[];
  };
};

function asName(v: CityObj | ServiceObj | NeighborhoodObj | CountyObj) {
  if (!v) return "";
  if (typeof v === "string") return v;
  return v.name ?? v.slug ?? "";
}

function asSlug(v: CityObj | ServiceObj | NeighborhoodObj | CountyObj) {
  if (!v) return "";
  if (typeof v === "string") return v;
  return v.slug ?? "";
}

export default function ProgrammaticLanding({ page }: { page: PageDoc }) {
  const countyName = asName(page.county);
  const cityName = asName(page.city) || "your area";
  const neighborhoodName = asName(page.neighborhood);
  const serviceName = asName(page.service) || "Home Services";
  const citySlug = asSlug(page.city);
  const serviceSlug = asSlug(page.service);

  const locationLabel = page.locationLabel || neighborhoodName || cityName || "your area";
  const subtitleLocation = neighborhoodName ? [cityName, countyName].filter(Boolean).join(", ") : countyName ? `${countyName}` : "";

  const h1 =
    page.content?.headline ??
    page.content?.h1 ??
    `${serviceName} in ${locationLabel}`;
  const sub =
    page.content?.subheadline ??
    (subtitleLocation ? `${subtitleLocation}.` : "") +
    "Answer a few questions. Get an instant rough estimate. Get matched with pros.";

  const bullets =
    page.content?.bullets?.length
      ? page.content.bullets
      : [
          "Transparent pricing guidance",
          "Vetted, licensed, and insured pros",
          "Options at different budgets",
          "Fast response and clean workmanship",
          "Warranty guidance and support",
          "Communication you can trust",
        ];

  const ctas: CTA[] =
    page.content?.ctas?.length
      ? page.content.ctas
      : [
          {
            label: "Get instant estimate",
            href: `/estimate?city=${encodeURIComponent(citySlug || cityName)}&service=${encodeURIComponent(
              serviceSlug || serviceName
            )}&slug=${encodeURIComponent(page.slug)}`,
          },
          { label: "Talk to a specialist", href: "tel:+1-000-000-0000" },
        ];

  const faqs =
    page.content?.faqs?.length
      ? page.content.faqs
      : [
          {
            q: "How accurate is the instant estimate?",
            a: "It provides a reasonable range based on scope and finish. Final quotes follow a pro inspection.",
          },
          { q: "Do you charge for matching?", a: "No. Matching you with pros is free. You only pay for the work." },
          { q: "Are pros licensed and insured?", a: "Yes. We work only with vetted, licensed, and insured professionals." },
          { q: "Do I get multiple quotes?", a: "You can compare options. We'll outline budget tiers when possible." },
          { q: "How fast can someone come?", a: "Urgent jobs can often be seen quickly; scheduling depends on scope and crew." },
          { q: "Do you help with permits?", a: "We guide on permits where needed and help coordinate with the pro." },
          { q: "Is there a warranty?", a: "Warranty terms depend on materials and the pro. We'll present them clearly." },
          { q: "Can you work within my budget?", a: "Yes. We'll show options at different price points when available." },
        ];

  const scopeItems = [
    "Inspection and planning",
    "Material and finish guidance",
    "Permits guidance (as needed)",
    "Prep, protection, and site safety",
    "Installation / execution",
    "Cleanup and final walkthrough",
  ];

  const valueProps = [
    {
      title: "Transparent pricing guidance",
      desc: "Clarity on ranges and what drives cost so you can make confident decisions.",
      Icon: Scale,
    },
    {
      title: "Vetted pros, licensed & insured",
      desc: "We prioritize licensed, insured teams with a track record of quality.",
      Icon: ShieldCheck,
    },
    {
      title: "Compare options and timelines",
      desc: "See options and scheduling trade-offs to fit your goals and budget.",
      Icon: BadgeCheck,
    },
    {
      title: "Fast response and scheduling",
      desc: "Quick replies and clear next steps to keep your project moving.",
      Icon: Clock,
    },
    {
      title: "Clean workmanship standards",
      desc: "Respectful crews, tidy sites, and professional finishes every time.",
      Icon: Wrench,
    },
    {
      title: "Warranty guidance and support",
      desc: "Understand warranty coverage and get help coordinating with pros.",
      Icon: Headset,
    },
  ];

  const steps = [
    { title: "Tell us your project", body: "Share scope, timeline, photos, and any preferences." },
    { title: "Get an instant rough estimate", body: "We give you a credible range based on similar work and scope." },
    { title: "Get matched with pros", body: "We connect you with vetted pros and coordinate next steps." },
  ];

  const testimonials = [
    {
      quote: "They matched us with a great crew, and the estimate range was spot on.",
      name: "Alex R.",
      location: locationLabel,
    },
    {
      quote: "Clean, on time, and transparent pricing. Exactly what we wanted.",
      name: "Jordan P.",
      location: "Local homeowner",
    },
    {
      quote: "Fast response and clear expectations. Would use again.",
      name: "Casey M.",
      location: serviceName,
    },
  ];

  const neighborhoods =
    page.content?.neighborhoods?.length && page.content.neighborhoods.length > 0
      ? page.content.neighborhoods
      : ["Old Town", "Downtown", "Northside", "Eastside", "Westside", "Lakeshore"];

  const helpfulLinks = [
    { title: "Get estimate", href: ctas[0]?.href ?? "/estimate" },
    { title: "Talk to a specialist", href: ctas[1]?.href ?? "/estimate" },
    { title: "See recent projects", href: "/#projects" },
  ];

  return (
    <main className="relative min-h-screen bg-slate-50 text-slate-900">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-gradient-to-b from-indigo-50 via-slate-50 to-transparent" />

      <header className="relative border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="text-sm font-semibold tracking-wide">
            Admin Studio
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-700 sm:flex">
            <a href="#how">How it works</a>
            <a href="#pricing">Pricing</a>
            <a href="#faq">FAQ</a>
          </nav>
          <div className="flex items-center gap-3">
            <a
              href={ctas[0]?.href ?? "/estimate"}
              className="inline-flex items-center justify-center rounded-xl border border-indigo-600 bg-transparent px-4 py-2 text-sm font-semibold text-indigo-700 shadow-sm hover:bg-indigo-50"
            >
              {ctas[0]?.label ?? "Get instant estimate"}
            </a>
          </div>
        </div>
      </header>

      <div className="relative mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Hero */}
        <section className="py-12">
          <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12 lg:gap-10">
            <div className="space-y-6 lg:col-span-7">
              <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-100">
                <span className="h-2 w-2 rounded-full bg-indigo-600" />
                {locationLabel} - {serviceName}
              </div>
              <h1 className="text-4xl font-semibold tracking-tight text-slate-900 lg:text-5xl">{h1}</h1>
              <p className="text-lg leading-relaxed text-slate-600">{sub}</p>

              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-100">
                  4.8/5 average from 2,100+ projects
                </span>
                {["Licensed & insured", "Background checked", "Matched in minutes", "No spam"].map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center rounded-full bg-slate-900/5 px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200"
                  >
                    {t}
                  </span>
                ))}
              </div>

              <div className="flex flex-wrap gap-3">
                <a
                  href={ctas[0]?.href ?? "/estimate"}
                  className="inline-flex items-center justify-center rounded-2xl border border-indigo-600 bg-transparent px-6 py-3 text-sm font-semibold text-indigo-700 shadow-sm hover:bg-indigo-50"
                >
                  {ctas[0]?.label ?? "Get instant estimate"}
                </a>
                <a
                  href={ctas[1]?.href ?? "/estimate"}
                  className="inline-flex items-center justify-center rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50"
                >
                  {ctas[1]?.label ?? "Talk to a specialist"}
                </a>
              </div>

              <p className="max-w-3xl text-base leading-relaxed text-slate-700">
                {page.content?.intro ??
                  `Get a fast, no-pressure estimate for ${serviceName.toLowerCase()} in ${cityName}. We match you with vetted pros, outline options at different budgets, and keep communication clear.`}
              </p>

              <div className="grid grid-cols-2 gap-3 rounded-3xl border border-slate-200 bg-white/80 p-4 ring-1 ring-slate-100 sm:grid-cols-4">
                {["Trusted locally", "Clean workmanship", "Fast response", "Warranty guidance"].map((t) => (
                  <div key={t} className="text-sm font-semibold text-slate-900">
                    {t}
                  </div>
                ))}
              </div>
            </div>

            <aside className="lg:col-span-5">
              <div className="w-full rounded-3xl border border-slate-200 bg-white p-6 shadow-sm ring-1 ring-slate-100 lg:sticky lg:top-8">
                <div className="text-lg font-bold text-slate-900">Fast estimate</div>
                <div className="mt-1 text-sm text-slate-600">Tell us about your project. We'll respond quickly.</div>

                <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                  <div>
                    <span className="text-slate-500">City:</span> {cityName}
                  </div>
                  <div className="mt-1">
                    <span className="text-slate-500">Service:</span> {serviceName}
                  </div>
                  <div className="mt-3 text-xs text-slate-500">Replace with your form component.</div>
                </div>

                <div className="mt-4 grid gap-2">
                  <a
                    href={ctas[0]?.href ?? "/estimate"}
                    className="w-full rounded-2xl border border-indigo-600 bg-transparent px-4 py-3 text-center text-sm font-semibold text-indigo-700 shadow-sm hover:bg-indigo-50"
                  >
                    {ctas[0]?.label ?? "Get instant estimate"}
                  </a>
                  <a
                    href={ctas[1]?.href ?? "/estimate"}
                    className="w-full rounded-2xl bg-white px-4 py-3 text-center text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50"
                  >
                    {ctas[1]?.label ?? "Talk to a specialist"}
                  </a>
                </div>

                <div className="mt-4 text-xs text-slate-500">
                  Typical response time: under 15 minutes during business hours.
                </div>
              </div>
            </aside>
          </div>
        </section>

        <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

        {/* How it works */}
        <section id="how" className="py-12">
          <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm ring-1 ring-slate-100 sm:p-10">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">How it works</h2>
            <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              {steps.map((s, idx) => (
                <div key={s.title} className="flex w-full items-center gap-4">
                  <div className="w-full flex-1 rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-sm transition hover:shadow-md">
                    <div className="text-lg font-semibold text-slate-900">{s.title}</div>
                    <div className="mt-2 text-base leading-relaxed text-slate-600">{s.body}</div>
                  </div>
                  {idx < steps.length - 1 && (
                    <div className="hidden items-center md:flex">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900/5 ring-1 ring-slate-200">
                        <ArrowRight className="h-5 w-5 text-slate-500" />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

        {/* Value props */}
        <section className="py-12">
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Why homeowners choose us</h2>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {valueProps.map(({ title, desc, Icon }) => (
              <div
                key={title}
                className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-[1px] hover:shadow-md"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600/10 ring-1 ring-indigo-600/20">
                    <Icon className="h-6 w-6 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">{title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">{desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

        {/* Scope */}
        <section className="py-12">
          <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm ring-1 ring-slate-100 sm:p-8">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">{serviceName} scope (typical)</h2>
            <ul className="mt-4 grid list-disc gap-2 pl-5 text-slate-700 sm:grid-cols-2">
              {scopeItems.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
        </section>

        <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

        {/* Pricing */}
        <section id="pricing" className="py-12">
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Pricing guidance</h2>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="text-sm font-semibold text-slate-900">Instant rough estimate</div>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">
                You'll see a credible range based on similar work and scope. Final quote follows a pro inspection.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="text-sm font-semibold text-slate-900">What affects price</div>
              <ul className="mt-2 grid list-disc gap-2 pl-5 text-sm text-slate-700">
                <li>Size and complexity of the project</li>
                <li>Material and finish choices</li>
                <li>Access, permits, and code requirements</li>
                <li>Urgency and scheduling</li>
              </ul>
            </div>
          </div>
        </section>

        <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

        {/* Service area */}
        <section className="py-12">
          <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm ring-1 ring-slate-100 sm:p-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Serving {cityName} and nearby</h2>
              <span className="text-xs font-semibold text-slate-500">
                Coverage across the metro for faster scheduling
              </span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {neighborhoods.map((n) => (
                <span
                  key={n}
                  className="inline-flex items-center rounded-full bg-slate-900/5 px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200"
                >
                  {n}
                </span>
              ))}
            </div>
          </div>
        </section>

        <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

        {/* Testimonials */}
        <section className="py-12">
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Homeowner stories</h2>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {testimonials.map((t) => (
              <div key={t.quote} className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="text-sm leading-relaxed text-slate-700">"{t.quote}"</div>
                <div className="mt-2 text-xs font-semibold text-slate-900">
                  {t.name} - {t.location}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="py-12">
          <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm ring-1 ring-slate-100 sm:p-8">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">FAQ</h2>
            <div className="mt-4 space-y-3">
              {faqs.map((f) => (
                <details key={f.q} className="w-full rounded-2xl border border-slate-200 bg-white p-4">
                  <summary className="cursor-pointer text-sm font-semibold text-slate-900">{f.q}</summary>
                  <div className="mt-2 text-sm leading-relaxed text-slate-700">{f.a}</div>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Helpful links */}
        <section className="pb-10">
          <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm ring-1 ring-slate-100 sm:p-8">
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">Helpful links</h2>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {helpfulLinks.map((link) => (
                <a
                  key={link.title}
                  href={link.href}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:-translate-y-[1px] hover:shadow-md"
                >
                  {link.title}
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="pb-16">
          <div className="rounded-3xl border border-indigo-100 bg-indigo-50 p-6 shadow-sm ring-1 ring-indigo-100 sm:p-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-lg font-bold text-slate-900">Get your estimate in 60 seconds</div>
                <div className="mt-1 text-sm text-slate-600">
                  Quick, no-pressure estimate for {serviceName.toLowerCase()} in {cityName}.
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <a
                  href={ctas[0]?.href ?? "/estimate"}
                  className="inline-flex items-center justify-center rounded-2xl border border-indigo-600 bg-transparent px-6 py-3 text-sm font-semibold text-indigo-700 shadow-sm hover:bg-indigo-50"
                >
                  {ctas[0]?.label ?? "Get instant estimate"}
                </a>
                <a
                  href={ctas[1]?.href ?? "/estimate"}
                  className="inline-flex items-center justify-center rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50"
                >
                  {ctas[1]?.label ?? "Talk to a specialist"}
                </a>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
