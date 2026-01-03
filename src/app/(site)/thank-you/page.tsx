"use client";

import { useEffect, useRef } from "react";

export default function ThankYouPage() {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    if (typeof window !== "undefined" && typeof (window as any).gtag === "function") {
      (window as any).gtag("event", "generate_lead", {
        event_category: "lead",
        event_label: "thank-you",
      });
      fired.current = true;
    }
  }, []);

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-3xl font-semibold text-slate-900">Thank you</h1>
      <p className="mt-3 text-slate-600">We received your request and will reach out shortly.</p>
    </div>
  );
}
