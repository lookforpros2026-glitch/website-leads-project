import React from "react";

type CTA = { label: string; href: string };
type FeatureItem = { title: string; body: string };
type StepItem = { title: string; body: string };
type FAQItem = { q: string; a: string };

type Section =
  | { type: "features"; heading: string; items: FeatureItem[] }
  | { type: "steps"; heading: string; steps: StepItem[] }
  | { type: "faq"; heading: string; items: FAQItem[] }
  | { type: "cta"; heading: string; body: string; button?: CTA };

export type ProgrammaticContent = {
  hero?: {
    title?: string;
    subtitle?: string;
    ctas?: CTA[];
    badges?: string[];
  };
  sections?: Section[];
};

type Props = {
  title: string;
  city?: string;
  service?: string;
  content?: ProgrammaticContent | null;
};

const fallbackBadges = ["Licensed & insured", "Local team", "Fast response"];

export function ProgrammaticPage({ title, city, service, content }: Props) {
  const hero = content?.hero || {};
  const sections = content?.sections || [];

  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="lg:col-span-7 space-y-4">
            <p className="text-sm text-slate-600 uppercase tracking-wide">
              {service && city ? `${service} in ${city}` : "Local Service"}
            </p>
            <h1 className="text-4xl font-semibold tracking-tight">{hero.title || title}</h1>
            <p className="text-lg text-slate-700">
              {hero.subtitle ||
                "Request a fast, no-pressure estimate from a vetted local team. Transparent pricing and clean workmanship."}
            </p>
            <div className="flex flex-wrap gap-2">
              {(hero.badges && hero.badges.length ? hero.badges : fallbackBadges).map((b) => (
                <span
                  key={b}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700"
                >
                  {b}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {(hero.ctas && hero.ctas.length
                ? hero.ctas
                : [{ label: "Get an estimate", href: "#estimate" }, { label: "Call now", href: "tel:+1-000-000-0000" }]
              ).map((cta) => (
                <a
                  key={cta.label}
                  href={cta.href}
                  className="inline-flex items-center justify-center rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
                >
                  {cta.label}
                </a>
              ))}
            </div>
          </div>
          <div className="lg:col-span-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Fast estimate</h2>
              <p className="text-sm text-slate-600">Tell us about your project. We’ll respond quickly.</p>
              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <div>City: {city || "N/A"}</div>
                <div>Service: {service || "N/A"}</div>
                <div className="text-xs text-slate-500">Replace with your form component.</div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 space-y-8">
          {sections.map((section, idx) => {
            if (section.type === "features") {
              return (
                <div key={idx} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h3 className="text-xl font-semibold text-slate-900">{section.heading}</h3>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    {section.items.map((it) => (
                      <div key={it.title} className="space-y-1 rounded-xl border border-slate-100 bg-slate-50 p-4">
                        <div className="text-sm font-semibold text-slate-900">{it.title}</div>
                        <div className="text-sm text-slate-700">{it.body}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }
            if (section.type === "steps") {
              return (
                <div key={idx} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h3 className="text-xl font-semibold text-slate-900">{section.heading}</h3>
                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    {section.steps.map((step, i) => (
                      <div key={step.title} className="space-y-1 rounded-xl border border-slate-100 bg-slate-50 p-4">
                        <div className="text-xs font-semibold text-slate-500">Step {i + 1}</div>
                        <div className="text-sm font-semibold text-slate-900">{step.title}</div>
                        <div className="text-sm text-slate-700">{step.body}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }
            if (section.type === "faq") {
              return (
                <div key={idx} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h3 className="text-xl font-semibold text-slate-900">{section.heading}</h3>
                  <div className="mt-4 space-y-3">
                    {section.items.map((qa) => (
                      <div key={qa.q} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                        <div className="text-sm font-semibold text-slate-900">{qa.q}</div>
                        <div className="text-sm text-slate-700 mt-1">{qa.a}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }
            if (section.type === "cta") {
              return (
                <div key={idx} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h3 className="text-xl font-semibold text-slate-900">{section.heading}</h3>
                  <p className="text-sm text-slate-700 mt-2">{section.body}</p>
                  {section.button ? (
                    <a
                      href={section.button.href}
                      className="mt-4 inline-flex items-center justify-center rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
                    >
                      {section.button.label}
                    </a>
                  ) : null}
                </div>
              );
            }
            return null;
          })}
        </div>
      </div>
    </main>
  );
}
