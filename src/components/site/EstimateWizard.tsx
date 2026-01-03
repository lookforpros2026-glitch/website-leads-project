"use client";

import { Dispatch, SetStateAction, memo, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PricingServices } from "@/lib/estimate/pricing";
import type { EstimatorConfig } from "@/lib/estimator/types";
import { calcEstimate } from "@/lib/estimator/calc";
import { useEstimatorConfig } from "@/lib/estimator/useEstimatorConfig";
import { PillOption } from "@/components/estimator/PillOption";

type Step = "service" | "scope" | "location" | "contact" | "review";
type EstimatorServiceCategory =
  | "Interior"
  | "Exterior"
  | "Roofing"
  | "Plumbing"
  | "Electrical"
  | "HVAC"
  | "Flooring & Tile"
  | "Drywall"
  | "Painting"
  | "Concrete & Masonry"
  | "Foundation"
  | "Doors & Windows"
  | "Outdoor Living"
  | "ADU & Additions"
  | "General";

type EstimateForm = {
  city?: string;
  service?: PricingServices | null;
  slug?: string;
  size?: "small" | "medium" | "large";
  finish?: "basic" | "standard" | "premium";
  urgency?: "asap" | "soon" | "flexible";
  propertyType?: "house" | "condo" | "apartment" | "townhome" | "other";
  complexity?: "standard" | "complex";
  permitLikely?: boolean;
  sqft?: number;
  layoutChange?: boolean;
  cabinets?: "stock" | "semi-custom" | "custom";
  countertop?: "laminate" | "quartz" | "stone";
  fixtures?: number;
  notes?: string;
  zip?: string;
  address?: string;
  fullName?: string;
  phone?: string;
  email?: string;
  consent?: boolean;
};

const stepsOrder: Step[] = ["service", "scope", "location", "contact", "review"];
const GROUP_ORDER: EstimatorServiceCategory[] = [
  "Interior",
  "Exterior",
  "Roofing",
  "Plumbing",
  "Electrical",
  "HVAC",
  "Flooring & Tile",
  "Drywall",
  "Painting",
  "Concrete & Masonry",
  "Foundation",
  "Doors & Windows",
  "Outdoor Living",
  "ADU & Additions",
  "General",
];

const CITY_MULT: Record<string, number> = {
  "los angeles": 1.0,
  "pasadena": 1.05,
  "santa monica": 1.12,
  "beverly hills": 1.2,
};

function normalizeService(value: string | null, config: EstimatorConfig | null): PricingServices | null {
  if (!value) return null;
  const normalized = value.replace(/_/g, "-");
  const key = normalized as PricingServices;
  if (!config) return key;
  return config.services.some((s) => s.key === key) ? key : null;
}

function getServiceLabel(key: PricingServices | null | undefined, services: { key: PricingServices; label: string }[]) {
  if (!key) return "Service";
  const found = services.find((s) => s.key === key);
  return found?.label ?? key.replace(/_/g, " ");
}

function normalizePhone(value?: string) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeEmail(value?: string) {
  return String(value || "").trim().toLowerCase();
}

function getUtcDay() {
  const now = new Date();
  return now.toISOString().slice(0, 10);
}

function getUtmFromSearch(search: ReturnType<typeof useSearchParams>) {
  return {
    source: search.get("utm_source") || "",
    medium: search.get("utm_medium") || "",
    campaign: search.get("utm_campaign") || "",
    term: search.get("utm_term") || "",
    content: search.get("utm_content") || "",
  };
}

function readCookie(name: string) {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : "";
}

function writeCookie(name: string, value: string, days: number) {
  if (typeof document === "undefined") return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; Expires=${expires}; Path=/; SameSite=Lax`;
}

function getOrCreateSessionId() {
  if (typeof localStorage === "undefined") return "";
  const key = "lead_session_id";
  let value = localStorage.getItem(key);
  if (!value) {
    value = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(key, value);
  }
  return value;
}

function getStoredAttribution() {
  if (typeof localStorage === "undefined") {
    return { utm: null as any, gclid: "" };
  }
  const raw = localStorage.getItem("lead_utm");
  let utm: any = null;
  try {
    utm = raw ? JSON.parse(raw) : null;
  } catch {
    utm = null;
  }
  const gclid = localStorage.getItem("lead_gclid") || readCookie("gclid") || "";
  return { utm, gclid };
}

type EstimateWizardProps = {
  pageSlug?: string;
  serviceName?: string;
  placeName?: string;
  zip?: string;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
};

export default function EstimateWizard({
  pageSlug: pageSlugProp,
  zip,
  open,
  onOpenChange,
}: EstimateWizardProps) {
  const search = useSearchParams();
  const isControlled = typeof open === "boolean";
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = isControlled ? Boolean(open) : internalOpen;
  const conversionFired = useRef(false);
  const setOpen = (value: boolean) => {
    onOpenChange?.(value);
    if (!isControlled) setInternalOpen(value);
  };
  const [step, setStep] = useState<Step>("service");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [restored, setRestored] = useState(false);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { loading: configLoading, services: configServices, config } = useEstimatorConfig();
  const [serviceSearch, setServiceSearch] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

  const initialForm = useMemo<EstimateForm>(
    () => ({
      city: search.get("city") || undefined,
      service: normalizeService(search.get("service"), config),
      slug: search.get("slug") || undefined,
      size: "medium",
      finish: "standard",
      urgency: "soon",
      propertyType: "house",
      complexity: "standard",
      permitLikely: false,
      zip: zip || undefined,
    }),
    [search, zip, config]
  );
  const [form, setForm] = useState<EstimateForm>(initialForm);

  const pageSlug = pageSlugProp || form.slug || search.get("slug") || "estimate-global";
  const storageKey = `estimator:v1:${pageSlug}`;

  useEffect(() => {
    // keep query params in sync if user lands with new params
    const city = search.get("city") || undefined;
    const service = normalizeService(search.get("service"), config);
    const slug = search.get("slug") || undefined;
    setForm((prev) => ({
      ...prev,
      city: city ?? prev.city,
      service: service ?? prev.service,
      slug: slug ?? prev.slug,
    }));
  }, [search, config]);

  useEffect(() => {
    const utm = getUtmFromSearch(search);
    const hasUtm = Object.values(utm).some((v) => Boolean(v));
    if (hasUtm && typeof localStorage !== "undefined") {
      localStorage.setItem("lead_utm", JSON.stringify(utm));
      writeCookie("utm_source", utm.source, 30);
      writeCookie("utm_medium", utm.medium, 30);
      writeCookie("utm_campaign", utm.campaign, 30);
      writeCookie("utm_term", utm.term, 30);
      writeCookie("utm_content", utm.content, 30);
    }
    const gclid = search.get("gclid") || "";
    if (gclid && typeof localStorage !== "undefined") {
      localStorage.setItem("lead_gclid", gclid);
      writeCookie("gclid", gclid, 30);
    }
  }, [search]);

  useEffect(() => {
    if (restored) return;
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const stepIndex = Number(parsed?.stepIndex);
      const answers = parsed?.answers;
      if (answers && typeof answers === "object") {
        setForm((prev) => ({ ...prev, ...answers }));
      }
      if (Number.isInteger(stepIndex) && stepIndex >= 0 && stepIndex < stepsOrder.length) {
        setStep(stepsOrder[stepIndex]);
      }
    } catch {
      // ignore restore failures
    }
    setRestored(true);
  }, [restored, storageKey]);

  useEffect(() => {
    if (!restored) return;
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      try {
        const payload = {
          stepIndex: stepsOrder.indexOf(step),
          answers: form,
        };
        sessionStorage.setItem(storageKey, JSON.stringify(payload));
      } catch {
        // ignore persistence errors
      }
    }, 200);
    return () => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
    };
  }, [form, step, restored, storageKey]);

  const estimate = useMemo(() => {
    if (!form.service || !config) {
      return { low: 0, typical: 0, high: 0, explanation: [], confidence: "low" as const };
    }
    const urgency =
      form.urgency === "asap" ? "high" : form.urgency === "flexible" ? "low" : "normal";
    const complexity =
      form.finish === "premium" ? "premium" : form.finish === "basic" ? "basic" : "standard";

    const result = calcEstimate(config, {
      serviceKey: form.service,
      zip: form.zip,
      urgency,
      complexity,
    });

    const low = result.min;
    const high = result.max;
    const typical = Math.round((low + high) / 2);

    const answered = [
      form.sqft,
      form.layoutChange,
      form.cabinets,
      form.countertop,
      form.permitLikely,
      form.fixtures,
      form.propertyType,
      form.finish,
      form.city,
    ].filter(Boolean).length;
    const confidence = answered >= 6 ? "high" : answered >= 3 ? "medium" : "low";

    return { low, typical, high, explanation: [], confidence };
  }, [
    config,
    form.cabinets,
    form.city,
    form.countertop,
    form.finish,
    form.fixtures,
    form.layoutChange,
    form.permitLikely,
    form.propertyType,
    form.service,
    form.sqft,
    form.urgency,
    form.zip,
  ]);
  const selectedServiceConfig = useMemo(
    () => (configServices || []).find((s) => s.key === form.service) || null,
    [configServices, form.service]
  );

  function canProceed(current: Step, answers: EstimateForm) {
    if (current === "service") {
      return answers.service ? { ok: true } : { ok: false, reason: "Please select a service to continue." };
    }
    if (current === "scope") {
      if (answers.service === "kitchen_remodeling" && !answers.sqft) {
        return { ok: false, reason: "Please add square footage to continue." };
      }
      if (answers.service === "plumbing_repair" && !answers.fixtures) {
        return { ok: false, reason: "Please add fixture count to continue." };
      }
      return { ok: true };
    }
    if (current === "location") {
      return answers.propertyType && answers.finish
        ? { ok: true }
        : { ok: false, reason: "Please select property type and finish level." };
    }
    if (current === "contact") {
      if (!answers.fullName || !answers.phone) {
        return { ok: false, reason: "Please provide your name and phone to continue." };
      }
      if (!answers.consent) {
        return { ok: false, reason: "Please agree to be contacted to continue." };
      }
      return { ok: true };
    }
    if (current === "review") {
      if (!answers.fullName || !answers.phone) {
        return { ok: false, reason: "Please provide your name and phone to submit." };
      }
      if (!answers.consent) {
        return { ok: false, reason: "Please agree to be contacted to submit." };
      }
      return { ok: true };
    }
    return { ok: true };
  }

  const canProceedResult = canProceed(step, form);
  const helperText = !canProceedResult.ok ? canProceedResult.reason : error;

  function next() {
    if (!canProceedResult.ok) {
      return;
    }
    const idx = stepsOrder.indexOf(step);
    if (idx < stepsOrder.length - 1) setStep(stepsOrder[idx + 1]);
  }

  function prev() {
    const idx = stepsOrder.indexOf(step);
    if (idx > 0) setStep(stepsOrder[idx - 1]);
  }

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const gate = canProceed("review", form);
      if (!gate.ok) {
        setError(gate.reason || "Missing required fields.");
        setLoading(false);
        return;
      }

      const stored = getStoredAttribution();
      const utm = stored.utm || getUtmFromSearch(search);
      const gclid = stored.gclid;
      const normalizedPhone = normalizePhone(form.phone);
      const normalizedEmail = normalizeEmail(form.email);
      const selectedServiceKey = form.service ? String(form.service) : "";
      const selectedServiceName = selectedServiceKey ? getServiceLabel(form.service, SERVICE_OPTIONS) : "";
      const durationMinDays =
        selectedServiceConfig?.durationMinDays != null ? Number(selectedServiceConfig.durationMinDays) : null;
      const durationMaxDays =
        selectedServiceConfig?.durationMaxDays != null ? Number(selectedServiceConfig.durationMaxDays) : null;
      const slugPath =
        typeof window !== "undefined" && window.location?.pathname
          ? window.location.pathname
          : pageSlug || "/estimate";
      const estimatorVersion = config?.version != null ? `published_v${config.version}` : "published_v0";
      const sourceType = slugPath === "/estimate" ? "estimate" : "programmatic";
      const payload = {
        pageSlug: pageSlug || "",
        slugPath,
        pagePath: slugPath,
        sessionId: getOrCreateSessionId(),
        fullName: String(form.fullName || "").trim(),
        phone: normalizedPhone,
        email: normalizedEmail,
        message: form.notes || "",
        service: selectedServiceKey,
        city: form.city,
        zip: form.zip,
        gclid,
        estimate: {
          min: estimate.low,
          max: estimate.high,
          typical: estimate.typical,
          confidence: estimate.confidence,
          serviceKey: selectedServiceKey,
          serviceName: selectedServiceName,
        },
        durationMinDays,
        durationMaxDays,
        estimatorVersion,
        estimatorConfigId: "published",
        source: {
          type: sourceType,
          url: typeof window !== "undefined" ? window.location.href : "",
        },
        answers: {
          city: form.city,
          service: form.service,
          size: form.size,
          finish: form.finish,
          urgency: form.urgency,
          propertyType: form.propertyType,
          zip: form.zip,
          sqft: form.sqft,
          layoutChange: form.layoutChange,
          cabinets: form.cabinets,
          countertop: form.countertop,
          fixtures: form.fixtures,
          permitLikely: form.permitLikely,
          complexity: form.complexity,
          address: form.address,
          estimateLow: estimate.low,
          estimateHigh: estimate.high,
          estimateTypical: estimate.typical,
        },
        utm,
        referrer: typeof document !== "undefined" ? document.referrer || "" : "",
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent || "" : "",
        timestamps: { submittedAt: new Date().toISOString(), day: getUtcDay() },
      };

      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        if (j?.field) {
          throw new Error(`${j.error}: ${j.field} (${j.reason})`);
        }
        throw new Error(j?.error || "Failed to submit.");
      }

      setSubmitted(true);
      if (
        !conversionFired.current &&
        typeof window !== "undefined" &&
        typeof (window as any).gtag === "function"
      ) {
        (window as any).gtag("event", "generate_lead", {
          event_category: "lead",
          event_label: slugPath || pageSlug || "estimate",
        });
        conversionFired.current = true;
      }
      sessionStorage.removeItem(storageKey);
    } catch (e: any) {
      setError(e?.message || "Failed to submit");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-lg sm:p-8">
        <h1 className="text-2xl font-bold text-slate-900">Thank you</h1>
        <p className="mt-2 text-slate-600">We received your request. We'll reach out shortly.</p>
      </div>
    );
  }

  if (!isOpen) return null;

  const SERVICE_OPTIONS: { key: PricingServices; label: string; category: EstimatorServiceCategory }[] = (configServices || [])
    .map((s) => ({
      key: s.key as PricingServices,
      label: s.name,
      category: (s.category as EstimatorServiceCategory) || "General",
    }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl ring-1 ring-black/10 sm:p-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase text-slate-500">Instant estimate</div>
            <div className="text-xl font-bold text-slate-900">Tell us about your project</div>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <div>
              Step {stepsOrder.indexOf(step) + 1} of {stepsOrder.length}
            </div>
            {(!isControlled || onOpenChange) && (
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50"
              >
                Close
              </button>
            )}
          </div>
        </div>

        <div className="mt-2 h-2 rounded-full bg-slate-100">
          <div
            className="h-2 rounded-full bg-blue-600 transition-all"
            style={{ width: `${((stepsOrder.indexOf(step) + 1) / stepsOrder.length) * 100}%` }}
          />
        </div>

        <div className="mt-6 space-y-6 pb-28">
          {configLoading ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="h-11 rounded-xl border border-slate-200/60 bg-slate-100/50" />
              <div className="h-11 rounded-xl border border-slate-200/60 bg-slate-100/50" />
              <div className="h-11 rounded-xl border border-slate-200/60 bg-slate-100/50" />
              <div className="h-11 rounded-xl border border-slate-200/60 bg-slate-100/50" />
            </div>
          ) : SERVICE_OPTIONS.length === 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              No services are configured for the estimator. Go to <b>Admin → Estimator</b> and publish services.
            </div>
          ) : (
            <StepContent
              step={step}
              form={form}
              setForm={setForm}
              estimate={estimate}
              setError={setError}
              services={SERVICE_OPTIONS}
              serviceSearch={serviceSearch}
              onServiceSearch={setServiceSearch}
              selectedGroup={selectedGroup}
              onSelectGroup={(group) => {
                setSelectedGroup(group);
                setServiceSearch("");
              }}
            />
          )}

          <div className="sticky bottom-0 -mx-4 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 pb-[calc(env(safe-area-inset-bottom)+16px)]">
            {helperText && <div className="mb-2 text-xs text-rose-600">{helperText}</div>}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={prev}
                  disabled={step === "service"}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 sm:w-auto"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => {
                    sessionStorage.removeItem(storageKey);
                    setForm(initialForm);
                    setStep("service");
                    setError(null);
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-500 transition hover:bg-slate-50 sm:w-auto"
                >
                  Start over
                </button>
              </div>
              {step === "review" ? (
                <button
                  type="button"
                  onClick={submit}
                  disabled={loading || !canProceedResult.ok}
                  className="w-full rounded-xl border border-indigo-600 bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-50 sm:w-auto"
                >
                  {loading ? "Submitting..." : "Submit & match me"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={next}
                  disabled={!canProceedResult.ok}
                  className="w-full rounded-xl border border-indigo-600 bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-50 sm:w-auto"
                >
                  Next
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const StepContent = memo(function StepContent({
  step,
  form,
  setForm,
  estimate,
  setError,
  services,
  serviceSearch,
  onServiceSearch,
  selectedGroup,
  onSelectGroup,
}: {
  step: Step;
  form: EstimateForm;
  setForm: Dispatch<SetStateAction<EstimateForm>>;
  estimate: { low: number; typical: number; high: number; explanation: string[]; confidence: string };
  setError: (value: string | null) => void;
  services: { key: PricingServices; label: string; category: EstimatorServiceCategory }[];
  serviceSearch: string;
  onServiceSearch: (value: string) => void;
  selectedGroup: string | null;
  onSelectGroup: (group: string | null) => void;
}) {
  const enabledServices = useMemo(() => {
    const q = serviceSearch.trim().toLowerCase();
    return services.filter((s) => {
      const hay = `${s.label} ${s.key} ${s.category}`.toLowerCase();
      return !q || hay.includes(q);
    });
  }, [serviceSearch, services]);

  const groups = useMemo(() => {
    const set = new Set<string>();
    enabledServices.forEach((s) => set.add(s.category || "General"));
    return Array.from(set);
  }, [enabledServices]);

  const orderedGroups = useMemo(() => {
    const ordered = GROUP_ORDER.filter((g) => groups.includes(g)) as string[];
    const remaining = groups.filter((g) => !ordered.includes(g)).sort();
    return [...ordered, ...remaining];
  }, [groups]);

  const groupServices = useMemo(() => {
    if (!selectedGroup) return [];
    return enabledServices
      .filter((s) => (s.category || "General") === selectedGroup)
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [enabledServices, selectedGroup]);

  return (
    <>
      {step === "service" && (
        <div className="space-y-4">
          <div className="text-lg font-semibold text-slate-900">Choose a service</div>
          {selectedGroup ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    onSelectGroup(null);
                    onServiceSearch("");
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  ← All categories
                </button>
                <div className="text-sm font-semibold text-slate-900">{selectedGroup}</div>
              </div>

              <input
                value={serviceSearch}
                onChange={(e) => onServiceSearch(e.target.value)}
                placeholder={`Search in ${selectedGroup}...`}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-200"
              />

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {groupServices.map((s) => (
                  <PillOption
                    key={s.key}
                    onClick={() => {
                      setError(null);
                      setForm((p) => ({ ...p, service: s.key }));
                    }}
                    label={s.label}
                    selected={form.service === s.key}
                  />
                ))}

                {!groupServices.length && (
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
                    No services found.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <h3 className="text-base font-semibold">Choose a category</h3>
              <div className="mx-auto grid max-w-5xl grid-cols-1 gap-3 sm:grid-cols-3">
                {orderedGroups.map((group) => {
                  const count = enabledServices.filter((s) => (s.category || "General") === group).length;
                  return (
                    <PillOption
                      key={group}
                      onClick={() => onSelectGroup(group)}
                      label={group}
                      sublabel={`${count} options`}
                      selected={selectedGroup === group}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {step === "scope" && (
        <div className="space-y-4">
          <div className="text-lg font-semibold text-slate-900">Scope</div>

          {form.service === "kitchen_remodeling" && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-slate-700">Approximate size (sqft)</label>
                <input
                  type="number"
                  min={0}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={form.sqft ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, sqft: Number(e.target.value) || undefined }))}
                  placeholder="e.g. 180"
                />
              </div>
              <div className="text-sm font-semibold text-slate-700">Layout change?</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <PillOption
                  label="Yes"
                  selected={form.layoutChange === true}
                  onClick={() => setForm((p) => ({ ...p, layoutChange: true }))}
                />
                <PillOption
                  label="No"
                  selected={form.layoutChange === false}
                  onClick={() => setForm((p) => ({ ...p, layoutChange: false }))}
                />
              </div>

              <div className="text-sm font-semibold text-slate-700">Cabinet type</div>
              <div className="grid gap-3 sm:grid-cols-3">
                {(["stock", "semi-custom", "custom"] as const).map((c) => (
                  <PillOption
                    key={c}
                    onClick={() => setForm((p) => ({ ...p, cabinets: c }))}
                    label={c.replace("-", " ")}
                    selected={form.cabinets === c}
                  />
                ))}
              </div>

              <div className="text-sm font-semibold text-slate-700">Countertop</div>
              <div className="grid gap-3 sm:grid-cols-3">
                {(["laminate", "quartz", "stone"] as const).map((c) => (
                  <PillOption
                    key={c}
                    onClick={() => setForm((p) => ({ ...p, countertop: c }))}
                    label={c}
                    selected={form.countertop === c}
                  />
                ))}
              </div>
            </div>
          )}

          {form.service === "plumbing_repair" && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-slate-700">Number of fixtures</label>
                <input
                  type="number"
                  min={0}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={form.fixtures ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, fixtures: Number(e.target.value) || undefined }))}
                  placeholder="e.g. 2"
                />
              </div>
              <div className="text-sm font-semibold text-slate-700">Emergency?</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <PillOption
                  label="Yes, ASAP"
                  selected={form.urgency === "asap"}
                  onClick={() => setForm((p) => ({ ...p, urgency: "asap" }))}
                />
                <PillOption
                  label="Soon / scheduled"
                  selected={form.urgency === "soon"}
                  onClick={() => setForm((p) => ({ ...p, urgency: "soon" }))}
                />
              </div>
            </div>
          )}

          <div className="text-sm font-semibold text-slate-700">Size</div>
          <div className="grid gap-3 sm:grid-cols-3">
            {(["small", "medium", "large"] as const).map((sz) => (
              <PillOption
                key={sz}
                onClick={() => setForm((p) => ({ ...p, size: sz }))}
                label={sz[0].toUpperCase() + sz.slice(1)}
                selected={form.size === sz}
              />
            ))}
          </div>
        </div>
      )}

      {step === "location" && (
        <div className="space-y-4">
          <div className="text-lg font-semibold text-slate-900">Property type</div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(["house", "condo", "apartment", "townhome", "other"] as const).map((pt) => (
              <PillOption
                key={pt}
                onClick={() => setForm((p) => ({ ...p, propertyType: pt }))}
                label={pt[0].toUpperCase() + pt.slice(1)}
                selected={form.propertyType === pt}
              />
            ))}
          </div>
          <div className="text-lg font-semibold text-slate-900">Finish level</div>
          <div className="grid gap-3 sm:grid-cols-3">
            {(["basic", "standard", "premium"] as const).map((f) => (
              <PillOption
                key={f}
                onClick={() => setForm((p) => ({ ...p, finish: f }))}
                label={f[0].toUpperCase() + f.slice(1)}
                selected={form.finish === f}
              />
            ))}
          </div>
        </div>
      )}

      {step === "contact" && (
        <div className="space-y-4">
          <div className="text-lg font-semibold text-slate-900">Contact</div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-semibold text-slate-700">Full name</label>
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={form.fullName || ""}
                onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700">Phone</label>
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={form.phone || ""}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700">Email</label>
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={form.email || ""}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex items-start gap-2">
            <input
              id="consent"
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-slate-300"
              checked={!!form.consent}
              onChange={(e) => setForm((p) => ({ ...p, consent: e.target.checked }))}
            />
            <label htmlFor="consent" className="text-sm text-slate-700">
              I agree to be contacted about my estimate.
            </label>
          </div>
        </div>
      )}

      {step === "review" && (
        <div className="space-y-4">
          <div className="text-lg font-semibold text-slate-900">Rough estimate</div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-2xl font-bold text-slate-900">
              Estimated range: ${estimate.low.toLocaleString()} - ${estimate.high.toLocaleString()}
            </div>
            <div className="mt-1 text-sm text-slate-700">
              Most {getServiceLabel(form.service, services).toLowerCase()} projects{form.city ? ` in ${form.city}` : ""} like yours land around ${estimate.typical.toLocaleString()}, depending on finishes, access, and permits.
            </div>
            <div className="mt-2 inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-100">
              Confidence: {estimate.confidence}
            </div>
          </div>
          <div className="text-sm text-slate-700">
            We use your scope, finish level, permits, urgency, and market to generate this range. A vetted pro will confirm on-site.
          </div>
          {estimate.explanation.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
              {estimate.explanation.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
});
