import EstimateForm from "@/components/landing/EstimateForm";
import { LandingContent, clampLanding } from "@/lib/contracts/landing";

export default function ServiceLandingTemplate({
  content,
  pageSlug,
}: {
  content: LandingContent | Partial<LandingContent>;
  pageSlug: string;
}) {
  const c = clampLanding(content as any);

  return (
    <main className="min-h-screen bg-white">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="text-sm font-semibold text-slate-900">LocalPro</div>
          <div className="text-sm text-slate-600">Fast estimates - Clear pricing - Professional crews</div>
        </div>
      </div>

      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{c.hero.headline}</h1>
            <p className="mt-3 text-base text-slate-600">{c.hero.subheadline}</p>

            <div className="mt-6 grid grid-cols-1 gap-2">
              {c.hero.bullets.map((b, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="mt-2 h-2 w-2 rounded-full bg-slate-900" />
                  <div className="text-sm text-slate-700">{b}</div>
                </div>
              ))}
            </div>

            <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-5">
              <div className="text-xs font-medium text-slate-700">Trusted by homeowners</div>
              <div className="mt-2 text-sm text-slate-900">"{c.trust.reviewSnippet.quote}"</div>
              <div className="mt-2 text-xs text-slate-600">
                - {c.trust.reviewSnippet.name}, {c.trust.reviewSnippet.city ?? c.city}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {c.trust.badges.map((b, i) => (
                  <span key={i} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700">
                    {b}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-6">
              <EstimateForm service={c.service} city={c.city} pageSlug={pageSlug} />
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <h2 className="text-xl font-semibold text-slate-900">How it works</h2>
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            {c.process.steps.map((s, i) => (
              <div key={i} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-xs font-medium text-slate-600">Step {i + 1}</div>
                <div className="mt-2 text-sm font-semibold text-slate-900">{s.title}</div>
                <div className="mt-2 text-sm text-slate-600">{s.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        <h2 className="text-xl font-semibold text-slate-900">
          {c.service} in {c.city}
        </h2>
        <p className="mt-3 text-sm text-slate-600">{c.local.paragraph}</p>

        {c.local.nearbyAreas.length > 0 && (
          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-semibold text-slate-900">Nearby areas</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {c.local.nearbyAreas.map((a, i) => (
                <span key={i} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700">
                  {a}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <h2 className="text-xl font-semibold text-slate-900">FAQ</h2>
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            {c.faq.map((f, i) => (
              <div key={i} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-sm font-semibold text-slate-900">{f.q}</div>
                <div className="mt-2 text-sm text-slate-600">{f.a}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-slate-600">
          (c) {new Date().getFullYear()} LocalPro. Fast estimates and professional service.
        </div>
      </footer>
    </main>
  );
}
