"use client";

import { useState } from "react";
import EstimateWizard from "@/components/site/EstimateWizard";

export default function EstimatorEmbed({
  pageSlug,
  serviceName,
  placeName,
  zip,
}: {
  pageSlug: string;
  serviceName?: string;
  placeName?: string;
  zip?: string;
}) {
  const [open, setOpen] = useState(false);
  const phone = process.env.NEXT_PUBLIC_CONTACT_PHONE || "+1-000-000-0000";

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-slate-100">Instant estimate</div>
          <div className="mt-1 text-xs text-slate-400">
            Get a quick quote for {serviceName || "your project"} in {placeName || "your area"}.
          </div>
        </div>

        <button
          className="h-11 rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-900"
          onClick={() => setOpen(true)}
          type="button"
        >
          Start estimate
        </button>
      </div>

      <div className="mt-3">
        <a
          href={`tel:${phone}`}
          onClick={() => {
            if (typeof window !== "undefined" && typeof (window as any).gtag === "function") {
              (window as any).gtag("event", "click_call", {
                event_category: "lead",
                event_label: pageSlug,
              });
            }
          }}
          className="text-xs font-semibold text-slate-200 underline"
        >
          Call now
        </a>
      </div>

      {open ? (
        <EstimateWizard
          pageSlug={pageSlug}
          serviceName={serviceName}
          placeName={placeName}
          zip={zip}
          open={open}
          onOpenChange={setOpen}
        />
      ) : null}
    </div>
  );
}
