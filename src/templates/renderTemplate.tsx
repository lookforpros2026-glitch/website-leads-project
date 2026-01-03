import React from "react";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Clock,
  Headset,
  Scale,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import type { BlockNode, TemplateLayout } from "./types";
import { buildCanonicalPath } from "@/lib/page-paths";

import EstimatorBlockClient from "./blocks/EstimatorBlockClient";
import EstimatorBlockPreview from "./blocks/EstimatorBlockPreview";

type CityObj = { locationId?: string; name?: string; slug?: string } | string | null | undefined;
type ServiceObj = { serviceId?: string; name?: string; slug?: string; category?: string } | string | null | undefined;
type NeighborhoodObj = { neighborhoodId?: string; name?: string; slug?: string } | string | null | undefined;
type CountyObj = { countyId?: string; name?: string; slug?: string } | string | null | undefined;

type PageDoc = {
  slug?: string;
  slugPath?: string;
  status?: string;
  locationLabel?: string;
  neighborhood?: NeighborhoodObj;
  county?: CountyObj;
  city?: CityObj;
  service?: ServiceObj;
  zip?: string;
  content?: {
    headline?: string;
    subheadline?: string;
    h1?: string;
    intro?: string;
    bullets?: string[];
    faqs?: { q: string; a: string }[];
    neighborhoods?: string[];
    gallery?: { src: string; alt?: string }[];
    ctas?: { label: string; href: string }[];
  };
};

type TemplateContext = ReturnType<typeof buildContext>;

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

function applyTokens(input: string, ctx: TemplateContext) {
  return input
    .replace(/\{service\}/gi, ctx.serviceName)
    .replace(/\{place\}/gi, ctx.locationLabel)
    .replace(/\{city\}/gi, ctx.cityName)
    .replace(/\{zip\}/gi, ctx.zip || "")
    .replace(/\{county\}/gi, ctx.countyName);
}

function buildContext(page: PageDoc) {
  const countyName = asName(page.county);
  const countySlug = (page as any).countySlug || asSlug((page as any).county) || "";
  const cityName = asName(page.city) || "your area";
  const neighborhoodName = asName(page.neighborhood);
  const serviceName = asName(page.service) || "Home Services";
  const citySlug = asSlug(page.city);
  const serviceSlug = asSlug(page.service);
  const zip = page.zip || "";

  const locationLabel = page.locationLabel || neighborhoodName || cityName || "your area";
  const subtitleLocation = neighborhoodName
    ? [cityName, countyName].filter(Boolean).join(", ")
    : countyName
    ? `${countyName}`
    : "";

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

  const ctas =
    page.content?.ctas?.length
      ? page.content.ctas
      : [
          {
            label: "Get instant estimate",
            href: `/estimate?city=${encodeURIComponent(citySlug || cityName)}&service=${encodeURIComponent(
              serviceSlug || serviceName
            )}&slug=${encodeURIComponent(page.slug || page.slugPath || "")}`,
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
  const cityServicePath = citySlug && serviceSlug ? `/${countySlug}/${citySlug}/${serviceSlug}` : "";
  const zipPath = countySlug && zip ? `/${countySlug}/${zip}` : "";
  if (cityServicePath) {
    helpfulLinks.push({ title: `${serviceName} in ${cityName}`, href: cityServicePath });
  }
  if (zipPath) {
    helpfulLinks.push({ title: `ZIP ${zip} page`, href: zipPath });
  }

  return {
    countyName,
    cityName,
    neighborhoodName,
    serviceName,
    citySlug,
    serviceSlug,
    zip,
    locationLabel,
    subtitleLocation,
    h1,
    sub,
    bullets,
    ctas,
    faqs,
    scopeItems,
    valueProps,
    steps,
    testimonials,
    neighborhoods,
    helpfulLinks,
    countySlug,
    slug: page.slug || page.slugPath || "",
  };
}

function HeroBlock({ block, ctx }: { block: BlockNode; ctx: TemplateContext }) {
  const headlineTemplate = block.props?.headlineTemplate || ctx.h1;
  const h1 = applyTokens(headlineTemplate, ctx) || ctx.h1;
  const sub = block.props?.subheadline ? applyTokens(block.props.subheadline, ctx) : ctx.sub;
  const ctaText = block.props?.ctaText || ctx.ctas[0]?.label || "Get instant estimate";
  const ctaSecondaryText = block.props?.ctaSecondaryText || ctx.ctas[1]?.label || "Talk to a specialist";
  const badges = Array.isArray(block.props?.badges) && block.props.badges.length ? block.props.badges : ctx.bullets;

  return (
    <>
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
              href={ctx.ctas[0]?.href ?? "/estimate"}
              className="inline-flex items-center justify-center rounded-xl border border-indigo-600 bg-transparent px-4 py-2 text-sm font-semibold text-indigo-700 shadow-sm hover:bg-indigo-50"
            >
              {ctaText}
            </a>
          </div>
        </div>
      </header>

      <section className="py-12">
        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12 lg:gap-10">
          <div className="space-y-6 lg:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-100">
              <span className="h-2 w-2 rounded-full bg-indigo-600" />
              {ctx.locationLabel} - {ctx.serviceName}
            </div>
            <h1 className="text-4xl font-semibold tracking-tight text-slate-900 lg:text-5xl">{h1}</h1>
            <p className="text-lg leading-relaxed text-slate-600">{sub}</p>

            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-100">
                4.8/5 average from 2,100+ projects
              </span>
              {badges.map((t: string) => (
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
                href={ctx.ctas[0]?.href ?? "/estimate"}
                className="inline-flex items-center justify-center rounded-2xl border border-indigo-600 bg-transparent px-6 py-3 text-sm font-semibold text-indigo-700 shadow-sm hover:bg-indigo-50"
              >
                {ctaText}
              </a>
              <a
                href={ctx.ctas[1]?.href ?? "/estimate"}
                className="inline-flex items-center justify-center rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50"
              >
                {ctaSecondaryText}
              </a>
            </div>

            <p className="max-w-3xl text-base leading-relaxed text-slate-700">
              {ctx.locationLabel
                ? `Get a fast, no-pressure estimate for ${ctx.serviceName.toLowerCase()} in ${ctx.cityName}. We match you with vetted pros, outline options at different budgets, and keep communication clear.`
                : ctx.sub}
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
                  <span className="text-slate-500">City:</span> {ctx.cityName}
                </div>
                <div className="mt-1">
                  <span className="text-slate-500">Service:</span> {ctx.serviceName}
                </div>
                <div className="mt-3 text-xs text-slate-500">Replace with your form component.</div>
              </div>

              <div className="mt-4 grid gap-2">
                <a
                  href={ctx.ctas[0]?.href ?? "/estimate"}
                  className="w-full rounded-2xl border border-indigo-600 bg-transparent px-4 py-3 text-center text-sm font-semibold text-indigo-700 shadow-sm hover:bg-indigo-50"
                >
                  {ctaText}
                </a>
                <a
                  href={ctx.ctas[1]?.href ?? "/estimate"}
                  className="w-full rounded-2xl bg-white px-4 py-3 text-center text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50"
                >
                  {ctaSecondaryText}
                </a>
              </div>

              <div className="mt-4 text-xs text-slate-500">
                Typical response time: under 15 minutes during business hours.
              </div>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}

function TrustBlock({ block, ctx }: { block: BlockNode; ctx: TemplateContext }) {
  const stepsTitle = block.props?.stepsTitle || "How it works";
  const sectionTitle = block.props?.sectionTitle || "Why homeowners choose us";
  const testimonialsTitle = block.props?.testimonialsTitle || "Homeowner stories";

  return (
    <>
      <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

      <section id="how" className="py-12">
        <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm ring-1 ring-slate-100 sm:p-10">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{stepsTitle}</h2>
          <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            {ctx.steps.map((s, idx) => (
              <div key={s.title} className="flex w-full items-center gap-4">
                <div className="w-full flex-1 rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-sm transition hover:shadow-md">
                  <div className="text-lg font-semibold text-slate-900">{s.title}</div>
                  <div className="mt-2 text-base leading-relaxed text-slate-600">{s.body}</div>
                </div>
                {idx < ctx.steps.length - 1 && (
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

      <section className="py-12">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">{sectionTitle}</h2>
        </div>
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {ctx.valueProps.map(({ title, desc, Icon }) => (
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

      <section className="py-12">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">{testimonialsTitle}</h2>
        </div>
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {ctx.testimonials.map((t) => (
            <div key={t.quote} className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="text-sm leading-relaxed text-slate-700">"{t.quote}"</div>
              <div className="mt-2 text-xs font-semibold text-slate-900">
                {t.name} - {t.location}
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function EstimatorBlock({
  block,
  mode,
  ctx,
}: {
  block: BlockNode;
  mode: RenderMode;
  ctx: TemplateContext;
}) {
  const title = block.props?.title || "Instant estimate";
  const subtitle = block.props?.subtitle || "Answer a few questions to get a fast, credible range.";
  return (
    <>
      <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
      <section className="py-12">
        <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm ring-1 ring-slate-100 sm:p-8">
          <div className="text-xl font-semibold text-slate-900">{title}</div>
          <div className="mt-1 text-sm text-slate-600">{subtitle}</div>
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
            {mode === "builder" ? (
              <EstimatorBlockPreview />
            ) : (
              <EstimatorBlockClient
                pageSlug={ctx.slug}
                serviceName={ctx.serviceName}
                placeName={ctx.locationLabel}
                zip={ctx.zip}
              />
            )}
          </div>
        </div>
      </section>
    </>
  );
}

function ServicesBlock({ block, ctx }: { block: BlockNode; ctx: TemplateContext }) {
  const scopeTitle = applyTokens(block.props?.scopeTitle || "{service} scope (typical)", ctx);
  const pricingTitle = block.props?.pricingTitle || "Pricing guidance";
  const serviceAreaTitle = applyTokens(block.props?.serviceAreaTitle || "Serving {city} and nearby", ctx);

  return (
    <>
      <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

      <section className="py-12">
        <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm ring-1 ring-slate-100 sm:p-8">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">{scopeTitle}</h2>
          <ul className="mt-4 grid list-disc gap-2 pl-5 text-slate-700 sm:grid-cols-2">
            {ctx.scopeItems.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
      </section>

      <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

      <section id="pricing" className="py-12">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">{pricingTitle}</h2>
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

      <section className="py-12">
        <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm ring-1 ring-slate-100 sm:p-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">{serviceAreaTitle}</h2>
            <span className="text-xs font-semibold text-slate-500">Coverage across the metro for faster scheduling</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {ctx.neighborhoods.map((n) => (
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

      <section className="pb-10">
        <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm ring-1 ring-slate-100 sm:p-8">
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">Helpful links</h2>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {ctx.helpfulLinks.map((link) => (
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
    </>
  );
}

function FaqBlock({ block, ctx }: { block: BlockNode; ctx: TemplateContext }) {
  const title = block.props?.title || "FAQ";
  return (
    <section id="faq" className="py-12">
      <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm ring-1 ring-slate-100 sm:p-8">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h2>
        <div className="mt-4 space-y-3">
          {ctx.faqs.map((f) => (
            <details key={f.q} className="w-full rounded-2xl border border-slate-200 bg-white p-4">
              <summary className="cursor-pointer text-sm font-semibold text-slate-900">{f.q}</summary>
              <div className="mt-2 text-sm leading-relaxed text-slate-700">{f.a}</div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function CtaBlock({ block, ctx }: { block: BlockNode; ctx: TemplateContext }) {
  const title = applyTokens(block.props?.title || "Get your estimate in 60 seconds", ctx);
  const subtitle = applyTokens(block.props?.subtitle || "Quick, no-pressure estimate for {service} in {city}.", ctx);
  const buttonText = block.props?.buttonText || ctx.ctas[0]?.label || "Get instant estimate";

  return (
    <section className="pb-16">
      <div className="rounded-3xl border border-indigo-100 bg-indigo-50 p-6 shadow-sm ring-1 ring-indigo-100 sm:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-lg font-bold text-slate-900">{title}</div>
            <div className="mt-1 text-sm text-slate-600">{subtitle}</div>
          </div>
          <div className="flex flex-wrap gap-3">
            <a
              href={ctx.ctas[0]?.href ?? "/estimate"}
              className="inline-flex items-center justify-center rounded-2xl border border-indigo-600 bg-transparent px-6 py-3 text-sm font-semibold text-indigo-700 shadow-sm hover:bg-indigo-50"
            >
              {buttonText}
            </a>
            <a
              href={ctx.ctas[1]?.href ?? "/estimate"}
              className="inline-flex items-center justify-center rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50"
            >
              {ctx.ctas[1]?.label ?? "Talk to a specialist"}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function FooterBlock({ block }: { block: BlockNode }) {
  const contactPhone = block.props?.contactPhone || process.env.NEXT_PUBLIC_CONTACT_PHONE;
  const contactEmail = block.props?.contactEmail || process.env.NEXT_PUBLIC_CONTACT_EMAIL;
  return (
    <footer className="border-t border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-slate-600">
        <div className="flex flex-wrap items-center gap-3">
          <span>(c) {new Date().getFullYear()} LocalPro.</span>
          <a href="/privacy" className="hover:text-slate-900">Privacy</a>
          <span className="text-slate-300">|</span>
          <a href="/terms" className="hover:text-slate-900">Terms</a>
          {contactPhone ? (
            <>
              <span className="text-slate-300">|</span>
              <a href={`tel:${contactPhone}`} className="hover:text-slate-900">
                {contactPhone}
              </a>
            </>
          ) : null}
          {contactEmail ? (
            <>
              <span className="text-slate-300">|</span>
              <a href={`mailto:${contactEmail}`} className="hover:text-slate-900">
                {contactEmail}
              </a>
            </>
          ) : null}
        </div>
        <div className="mt-2">{block.props?.disclaimer || "Fast estimates and professional service."}</div>
      </div>
    </footer>
  );
}

export type RenderMode = "public" | "builder";

function renderBlock(block: BlockNode, ctx: TemplateContext, mode: RenderMode) {
  switch (block.type) {
    case "hero":
      return <HeroBlock key={block.id} block={block} ctx={ctx} />;
    case "trust":
      return <TrustBlock key={block.id} block={block} ctx={ctx} />;
    case "estimator":
      return <EstimatorBlock key={block.id} block={block} mode={mode} ctx={ctx} />;
    case "services":
      return <ServicesBlock key={block.id} block={block} ctx={ctx} />;
    case "faq":
      return <FaqBlock key={block.id} block={block} ctx={ctx} />;
    case "cta":
      return <CtaBlock key={block.id} block={block} ctx={ctx} />;
    case "footer":
      return <FooterBlock key={block.id} block={block} />;
    default:
      return null;
  }
}

export function renderTemplate(layout: TemplateLayout, pageData: PageDoc, mode: RenderMode = "public") {
  const ctx = buildContext(pageData);
  const slugPath = buildCanonicalPath(pageData) || pageData.slugPath || ctx.slug;
  const schemaBlocks: any[] = [];

  schemaBlocks.push({
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: `${ctx.serviceName} in ${ctx.cityName}`,
    url: slugPath,
    areaServed: ctx.cityName ? { "@type": "City", name: ctx.cityName } : undefined,
    serviceType: ctx.serviceName,
    address: {
      "@type": "PostalAddress",
      addressLocality: ctx.cityName,
      addressRegion: ctx.countyName,
      postalCode: ctx.zip,
    },
  });

  if (ctx.faqs.length) {
    schemaBlocks.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: ctx.faqs.map((faq) => ({
        "@type": "Question",
        name: faq.q,
        acceptedAnswer: {
          "@type": "Answer",
          text: faq.a,
        },
      })),
    });
  }

  return (
    <main className="relative min-h-screen bg-slate-50 text-slate-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaBlocks.filter(Boolean)) }}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-gradient-to-b from-indigo-50 via-slate-50 to-transparent" />

      <div className="relative mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        {layout.blocks.map((block) => renderBlock(block, ctx, mode))}
      </div>
    </main>
  );
}
