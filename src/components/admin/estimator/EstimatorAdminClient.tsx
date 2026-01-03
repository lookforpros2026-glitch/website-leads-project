"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ChevronRight } from "lucide-react";
import { EstimatorConfig, EstimatorService } from "@/lib/estimator/types";
import { buildDefaultEstimatorConfig } from "@/lib/estimator/defaultConfig";
import { calcEstimate } from "@/lib/estimator/calc";
import { slugify } from "@/lib/slug";

type TabKey = "services" | "pricing" | "steps" | "preview" | "publish";

type ServiceDoc = {
  id: string;
  key: string;
  name: string;
  category?: string | null;
  enabled?: boolean;
  sort?: number | null;
  estimator?: {
    enabled?: boolean;
    unit?: "job" | "sqft" | "linear_ft";
    baseMin?: number;
    baseMax?: number;
    defaultDurationDays?: { min?: number; max?: number };
  };
};

const CATEGORY_OPTIONS = [
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

export default function EstimatorAdminClient() {
  const [tab, setTab] = useState<TabKey>("services");
  const [draft, setDraft] = useState<EstimatorConfig | null>(buildDefaultEstimatorConfig("draft"));
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [services, setServices] = useState<ServiceDoc[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [draftInfo, setDraftInfo] = useState<{ version: number | null; updatedAt: string | null } | null>(null);
  const [publishedInfo, setPublishedInfo] = useState<{ version: number | null; publishedAt: string | null } | null>(null);

  const [serviceSearch, setServiceSearch] = useState("");
  const [selectedServiceKey, setSelectedServiceKey] = useState<string>("");
  const [openCats, setOpenCats] = useState<Record<string, boolean>>({});

  const [previewServiceKey, setPreviewServiceKey] = useState<string>("");
  const [previewZip, setPreviewZip] = useState<string>("");
  const [previewUrgency, setPreviewUrgency] = useState<"low" | "normal" | "high">("normal");
  const [previewComplexity, setPreviewComplexity] = useState<"basic" | "standard" | "premium">("standard");

  useEffect(() => {
    let active = true;
    (async () => {
      const [res, dbg, svcRes] = await Promise.all([
        fetch("/api/admin/estimator/get?mode=draft"),
        fetch("/api/admin/estimator/debug").catch(() => null),
        fetch("/api/admin/services?limit=1000"),
      ]);
      const json = await res.json().catch(() => ({}));
      if (!active) return;
      if (res.ok && json?.config) {
        setDraft(json.config);
      }
      if (dbg) {
        const dbgJson = await dbg.json().catch(() => ({}));
        if (!active) return;
        if (dbgJson?.ok) {
          setDraftInfo({
            version: dbgJson.draft?.version ?? null,
            updatedAt: dbgJson.draft?.updatedAt ?? null,
          });
          setPublishedInfo({
            version: dbgJson.published?.version ?? null,
            publishedAt: dbgJson.published?.publishedAt ?? null,
          });
        }
      }
      const svcJson = await svcRes.json().catch(() => ({}));
      if (!active) return;
      const svcItems = Array.isArray(svcJson?.items) ? svcJson.items : [];
      setServices(
        svcItems.map((svc: any) => ({
          id: String(svc.id || svc.key || svc.serviceKey || ""),
          key: String(svc.key || svc.serviceKey || svc.id || ""),
          name: String(svc.name || ""),
          category: svc.category ?? svc.groupKey ?? null,
          enabled: svc.enabled !== false && svc.isActive !== false,
          sort: svc.sort ?? null,
          estimator: svc.estimator || {
            enabled: svc.estimatorEnabled ?? true,
            unit: svc.estimatorUnit || "job",
            baseMin: svc.estimatorMin ?? svc.baseMin ?? svc.basePrice ?? 0,
            baseMax: svc.estimatorMax ?? svc.baseMax ?? svc.basePrice ?? 0,
            defaultDurationDays: svc.defaultDurationDays || undefined,
          },
        }))
      );
      setServicesLoading(false);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const saveDraft = async () => {
    if (!draft) return;
    setSaving(true);
    setMessage(null);
    try {
      const draftPayload = { ...draft, services: [] };
      const res = await fetch("/api/admin/estimator/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft: draftPayload }),
      });
      const json = await res.json().catch(() => ({}));
      setMessage(res.ok ? "Draft saved (not live yet)." : json?.error || "Save failed.");
      const dbg = await fetch("/api/admin/estimator/debug").then((r) => r.json().catch(() => ({})));
      if (dbg?.ok) {
        setDraftInfo({
          version: dbg.draft?.version ?? null,
          updatedAt: dbg.draft?.updatedAt ?? null,
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const publishDraft = async () => {
    if (!draft) return;
    setPublishing(true);
    setMessage(null);
    try {
      await saveDraft();
      const res = await fetch("/api/admin/estimator/publish", { method: "POST" });
      const json = await res.json().catch(() => ({}));
      setMessage(res.ok ? "Published. Live config updated." : json?.error || "Publish failed.");
      const dbg = await fetch("/api/admin/estimator/debug").then((r) => r.json().catch(() => ({})));
      if (dbg?.ok) {
        setDraftInfo({
          version: dbg.draft?.version ?? null,
          updatedAt: dbg.draft?.updatedAt ?? null,
        });
        setPublishedInfo({
          version: dbg.published?.version ?? null,
          publishedAt: dbg.published?.publishedAt ?? null,
        });
        const kitchenDraft = services.find((s) => s.key === "kitchen-remodeling");
        console.log(
          "Draft kitchen baseMin/baseMax",
          kitchenDraft?.estimator?.baseMin,
          kitchenDraft?.estimator?.baseMax
        );
        console.log(
          "Published kitchen baseMin/baseMax",
          dbg?.published?.firstService?.baseMin,
          dbg?.published?.firstService?.baseMax
        );
      }
    } finally {
      setPublishing(false);
    }
  };

  const filteredServices = useMemo(() => {
    const list = [...services];
    const q = serviceSearch.trim().toLowerCase();
    return list
      .filter((s) => (!q ? true : s.name.toLowerCase().includes(q) || s.key.includes(q)))
      .sort((a, b) => (a.sort ?? 9999) - (b.sort ?? 9999));
  }, [serviceSearch, services]);

  const groupedServices = useMemo(() => {
    const map = new Map<string, ServiceDoc[]>();
    for (const svc of filteredServices) {
      const key = (svc.category || "General").trim();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(svc);
    }
    for (const [key, arr] of map.entries()) {
      arr.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    }
    const order = [
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
    const ordered: Array<[string, ServiceDoc[]]> = [];
    for (const cat of order) {
      if (map.has(cat)) ordered.push([cat, map.get(cat)!]);
      map.delete(cat);
    }
    for (const entry of Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
      ordered.push(entry);
    }
    return ordered;
  }, [filteredServices]);

  useEffect(() => {
    if (!Object.keys(openCats).length && groupedServices.length) {
      setOpenCats({ [groupedServices[0][0]]: true });
    }
  }, [groupedServices, openCats]);

  const selectedService = services.find((s) => s.key === selectedServiceKey) || null;

  const updateService = (key: string, patch: Partial<ServiceDoc>) => {
    setServices((prev) =>
      prev.map((svc) => (svc.key === key ? { ...svc, ...patch } : svc))
    );
  };

  const loadServices = async () => {
    setServicesLoading(true);
    try {
      const res = await fetch("/api/admin/services?limit=1000");
      const json = await res.json().catch(() => ({}));
      const items = Array.isArray(json?.items) ? json.items : [];
      setServices(
        items.map((svc: any) => ({
          id: String(svc.id || svc.key || svc.serviceKey || ""),
          key: String(svc.key || svc.serviceKey || svc.id || ""),
          name: String(svc.name || ""),
          category: svc.category ?? svc.groupKey ?? null,
          enabled: svc.enabled !== false && svc.isActive !== false,
          sort: svc.sort ?? null,
          estimator: svc.estimator || {
            enabled: svc.estimatorEnabled ?? true,
            unit: svc.estimatorUnit || "job",
            baseMin: svc.estimatorMin ?? svc.baseMin ?? svc.basePrice ?? 0,
            baseMax: svc.estimatorMax ?? svc.baseMax ?? svc.basePrice ?? 0,
            defaultDurationDays: svc.defaultDurationDays || undefined,
          },
        }))
      );
    } finally {
      setServicesLoading(false);
    }
  };

  const addService = async () => {
    const key = slugify("New Service");
    const payload = {
      key,
      name: "New Service",
      category: "General",
      enabled: true,
      estimator: {
        enabled: true,
        unit: "job",
        baseMin: 1000,
        baseMax: 5000,
      },
    };
    await fetch("/api/admin/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    await loadServices();
    setSelectedServiceKey(key);
  };

  const removeService = async (key: string) => {
    const target = services.find((svc) => svc.key === key);
    if (!target) return;
    await fetch(`/api/admin/services/${encodeURIComponent(target.id)}`, { method: "DELETE" });
    await loadServices();
    if (selectedServiceKey === key) setSelectedServiceKey("");
  };

  const previewConfig = useMemo<EstimatorConfig | null>(() => {
    if (!draft) return null;
    const mappedServices: EstimatorService[] = services.map((svc, idx) => {
      const estimator = svc.estimator || {};
      return {
        key: svc.key,
        name: svc.name,
        category: svc.category || "",
        enabled: svc.enabled !== false,
        sort: svc.sort ?? idx,
        baseMin: Number(estimator.baseMin ?? 0),
        baseMax: Number(estimator.baseMax ?? 0),
        durationMinDays: estimator.defaultDurationDays?.min,
        durationMaxDays: estimator.defaultDurationDays?.max,
        unit: estimator.unit || "job",
      };
    });
    return { ...draft, services: mappedServices };
  }, [draft, services]);

  const preview = useMemo(() => {
    if (!previewServiceKey || !previewConfig) return null;
    return calcEstimate(previewConfig, {
      serviceKey: previewServiceKey,
      zip: previewZip,
      urgency: previewUrgency,
      complexity: previewComplexity,
    });
  }, [previewComplexity, previewConfig, previewServiceKey, previewUrgency, previewZip]);

  if (loading || !draft) {
    return <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 text-slate-300">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">Estimator Config</h1>
          <p className="text-xs text-slate-400">Edit estimator services, pricing rules, and steps.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={saveDraft} disabled={saving}>
            {saving ? "Saving..." : "Save draft"}
          </Button>
          <Button variant="primary" onClick={publishDraft} disabled={publishing}>
            {publishing ? "Publishing..." : "Publish"}
          </Button>
        </div>
      </div>

      {message && <div className="text-xs text-slate-300">{message}</div>}
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
        <span className="rounded-full border border-slate-800 px-2 py-1">
          Draft v{draftInfo?.version ?? draft.version ?? 0}
        </span>
        <span className="rounded-full border border-slate-800 px-2 py-1">
          Published v{publishedInfo?.version ?? 0}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(["services", "pricing", "steps", "preview", "publish"] as TabKey[]).map((k) => (
          <Button key={k} variant={tab === k ? "primary" : "secondary"} onClick={() => setTab(k)}>
            {k}
          </Button>
        ))}
      </div>

      {tab === "services" && (
        <div className="grid gap-4 lg:grid-cols-12">
          <section className="lg:col-span-5 rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Input value={serviceSearch} onChange={(e) => setServiceSearch(e.target.value)} placeholder="Search service" />
              <Button variant="secondary" onClick={addService}>Add</Button>
            </div>
            <div className="space-y-2">
              {servicesLoading && <div className="text-xs text-slate-400">Loading services...</div>}
              {!servicesLoading && filteredServices.length === 0 && (
                <div className="text-xs text-slate-400">No services yet.</div>
              )}
              <div className="space-y-3">
                {groupedServices.map(([cat, items]) => {
                  const open = !!openCats[cat];
                  return (
                    <div key={cat} className="rounded-2xl border border-slate-800/60 bg-slate-950/40">
                      <button
                        type="button"
                        onClick={() => setOpenCats((prev) => ({ ...prev, [cat]: !prev[cat] }))}
                        className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left"
                      >
                        <div>
                          <div className="text-sm font-semibold text-slate-100">{cat}</div>
                          <div className="text-xs text-slate-400">{items.length} services</div>
                        </div>
                        <ChevronRight className={`h-4 w-4 text-slate-300 transition-transform ${open ? "rotate-90" : "rotate-0"}`} />
                      </button>
                      {open && (
                        <div className="px-3 pb-3">
                          <div className="divide-y divide-slate-800/40 overflow-hidden rounded-xl border border-slate-800/50 bg-slate-950/30">
                            {items.map((svc) => (
                              <div
                                key={svc.key}
                                className="grid grid-cols-[56px_1fr_auto] items-center gap-3 px-3 py-3"
                              >
                                <button
                                  type="button"
                                  onClick={() => setSelectedServiceKey(svc.key)}
                                  className={`h-10 w-10 rounded-xl border transition ${
                                    selectedServiceKey === svc.key
                                      ? "border-emerald-300/50 bg-emerald-500/10"
                                      : "border-slate-700 bg-slate-950/20 hover:bg-white/5"
                                  }`}
                                  aria-label={`Select ${svc.name}`}
                                />
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-semibold text-slate-100">{svc.name}</div>
                                  <div className="truncate text-xs text-slate-400">{svc.category || "General"}</div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setSelectedServiceKey(svc.key)}
                                  className="h-9 rounded-xl border border-slate-700 bg-slate-950/40 px-4 text-xs text-slate-100 hover:bg-white/5"
                                >
                                  Edit
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
          <section className="lg:col-span-7 rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-3">
            {!selectedService ? (
              <div className="text-xs text-slate-400">Select a service to edit.</div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-slate-100">{selectedService.name}</div>
                  <Button variant="secondary" onClick={() => removeService(selectedService.key)}>Delete</Button>
                </div>
                <Input
                  value={selectedService.name}
                  onChange={(e) => updateService(selectedService.key, { name: e.target.value })}
                  placeholder="Service name"
                />
                <Select
                  value={selectedService.category || "General"}
                  onChange={(e) => updateService(selectedService.key, { category: e.target.value })}
                >
                  {CATEGORY_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </Select>
                <Input value={selectedService.key} readOnly placeholder="Key" />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    value={String(selectedService.estimator?.baseMin ?? "")}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      updateService(selectedService.key, {
                        estimator: { ...selectedService.estimator, baseMin: Number.isFinite(v) ? v : 0 },
                      });
                    }}
                    placeholder="Base min"
                  />
                  <Input
                    value={String(selectedService.estimator?.baseMax ?? "")}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      updateService(selectedService.key, {
                        estimator: { ...selectedService.estimator, baseMax: Number.isFinite(v) ? v : 0 },
                      });
                    }}
                    placeholder="Base max"
                  />
                </div>
                <Select
                  value={selectedService.estimator?.unit || "job"}
                  onChange={(e) =>
                    updateService(selectedService.key, {
                      estimator: { ...selectedService.estimator, unit: e.target.value as any },
                    })
                  }
                >
                  <option value="job">job</option>
                  <option value="sqft">sqft</option>
                  <option value="linear_ft">linear_ft</option>
                </Select>
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={selectedService.enabled !== false}
                    onChange={(e) => updateService(selectedService.key, { enabled: e.target.checked })}
                  />
                  Enabled
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={selectedService.estimator?.enabled !== false}
                    onChange={(e) =>
                      updateService(selectedService.key, {
                        estimator: { ...selectedService.estimator, enabled: e.target.checked },
                      })
                    }
                  />
                  Estimator
                </div>
                <Button
                  variant="primary"
                  onClick={async () => {
                    await fetch(`/api/admin/services/${encodeURIComponent(selectedService.id)}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        name: selectedService.name,
                        category: selectedService.category || null,
                        enabled: selectedService.enabled !== false,
                        estimator: selectedService.estimator || {},
                      }),
                    });
                    await loadServices();
                  }}
                >
                  Save changes
                </Button>
              </>
            )}
          </section>
        </div>
      )}

      {tab === "pricing" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-3">
            <div className="text-sm font-semibold text-slate-100">Global Multipliers</div>
            <Input
              value={String(draft.pricing.laborMultiplier)}
              onChange={(e) => setDraft((prev) => (prev ? { ...prev, pricing: { ...prev.pricing, laborMultiplier: Number(e.target.value) } } : prev))}
              placeholder="Labor multiplier"
            />
            <Input
              value={String(draft.pricing.materialMultiplier)}
              onChange={(e) => setDraft((prev) => (prev ? { ...prev, pricing: { ...prev.pricing, materialMultiplier: Number(e.target.value) } } : prev))}
              placeholder="Material multiplier"
            />
            <Input
              value={String(draft.pricing.minJob)}
              onChange={(e) => setDraft((prev) => (prev ? { ...prev, pricing: { ...prev.pricing, minJob: Number(e.target.value) } } : prev))}
              placeholder="Minimum job"
            />
            <Input
              value={String(draft.pricing.maxJob || "")}
              onChange={(e) => setDraft((prev) => (prev ? { ...prev, pricing: { ...prev.pricing, maxJob: Number(e.target.value) || undefined } } : prev))}
              placeholder="Maximum job"
            />
          </section>
          <section className="rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-3">
            <div className="text-sm font-semibold text-slate-100">Urgency Multipliers</div>
            <div className="grid grid-cols-3 gap-2">
              <Input
                value={String(draft.modifiers.urgency.low)}
                onChange={(e) => setDraft((prev) => (prev ? { ...prev, modifiers: { ...prev.modifiers, urgency: { ...prev.modifiers.urgency, low: Number(e.target.value) } } } : prev))}
                placeholder="Low"
              />
              <Input
                value={String(draft.modifiers.urgency.normal)}
                onChange={(e) => setDraft((prev) => (prev ? { ...prev, modifiers: { ...prev.modifiers, urgency: { ...prev.modifiers.urgency, normal: Number(e.target.value) } } } : prev))}
                placeholder="Normal"
              />
              <Input
                value={String(draft.modifiers.urgency.high)}
                onChange={(e) => setDraft((prev) => (prev ? { ...prev, modifiers: { ...prev.modifiers, urgency: { ...prev.modifiers.urgency, high: Number(e.target.value) } } } : prev))}
                placeholder="High"
              />
            </div>
            <div className="text-sm font-semibold text-slate-100">Complexity Multipliers</div>
            <div className="grid grid-cols-3 gap-2">
              <Input
                value={String(draft.modifiers.complexity.basic)}
                onChange={(e) => setDraft((prev) => (prev ? { ...prev, modifiers: { ...prev.modifiers, complexity: { ...prev.modifiers.complexity, basic: Number(e.target.value) } } } : prev))}
                placeholder="Basic"
              />
              <Input
                value={String(draft.modifiers.complexity.standard)}
                onChange={(e) => setDraft((prev) => (prev ? { ...prev, modifiers: { ...prev.modifiers, complexity: { ...prev.modifiers.complexity, standard: Number(e.target.value) } } } : prev))}
                placeholder="Standard"
              />
              <Input
                value={String(draft.modifiers.complexity.premium)}
                onChange={(e) => setDraft((prev) => (prev ? { ...prev, modifiers: { ...prev.modifiers, complexity: { ...prev.modifiers.complexity, premium: Number(e.target.value) } } } : prev))}
                placeholder="Premium"
              />
            </div>
          </section>
        </div>
      )}

      {tab === "steps" && (
        <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-3">
          {draft.steps.map((step, idx) => (
            <div key={step.id} className="rounded-xl border border-slate-800 p-3 space-y-2">
              <div className="text-xs text-slate-400">Step {idx + 1}</div>
              <Input
                value={step.title}
                onChange={(e) => {
                  const title = e.target.value;
                  setDraft((prev) =>
                    prev
                      ? {
                          ...prev,
                          steps: prev.steps.map((s) => (s.id === step.id ? { ...s, title } : s)),
                        }
                      : prev
                  );
                }}
                placeholder="Step title"
              />
              <Select
                value={step.type}
                onChange={(e) => {
                  const type = e.target.value as any;
                  setDraft((prev) =>
                    prev
                      ? {
                          ...prev,
                          steps: prev.steps.map((s) => (s.id === step.id ? { ...s, type } : s)),
                        }
                      : prev
                  );
                }}
              >
                <option value="service">service</option>
                <option value="details">details</option>
                <option value="urgency">urgency</option>
                <option value="contact">contact</option>
              </Select>
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={step.required}
                  onChange={(e) => {
                    const required = e.target.checked;
                  setDraft((prev) =>
                    prev
                      ? {
                          ...prev,
                          steps: prev.steps.map((s) => (s.id === step.id ? { ...s, required } : s)),
                        }
                      : prev
                  );
                }}
              />
                Required
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "preview" && (
        <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-3">
          <div className="grid gap-2 md:grid-cols-4">
            <Select value={previewServiceKey} onChange={(e) => setPreviewServiceKey(e.target.value)}>
              <option value="">Select service</option>
              {services.map((svc) => (
                <option key={svc.key} value={svc.key}>
                  {svc.name}
                </option>
              ))}
            </Select>
            <Input value={previewZip} onChange={(e) => setPreviewZip(e.target.value)} placeholder="ZIP" />
            <Select value={previewUrgency} onChange={(e) => setPreviewUrgency(e.target.value as any)}>
              <option value="low">low</option>
              <option value="normal">normal</option>
              <option value="high">high</option>
            </Select>
            <Select value={previewComplexity} onChange={(e) => setPreviewComplexity(e.target.value as any)}>
              <option value="basic">basic</option>
              <option value="standard">standard</option>
              <option value="premium">premium</option>
            </Select>
          </div>

          {preview ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-200">
              <div className="font-semibold">Estimate: ${preview.min} - ${preview.max}</div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-400">
                {preview.breakdown.map((b) => (
                  <div key={b.label}>{b.label}: {String(b.value)}</div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-400">Choose a service to preview.</div>
          )}
        </div>
      )}

      {tab === "publish" && (
        <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-2 text-xs text-slate-400">
          <div>Version: {draft.version}</div>
          <div>Status: {draft.status}</div>
          {draftInfo?.updatedAt && <div>Draft updated: {String(draftInfo.updatedAt)}</div>}
          {publishedInfo?.publishedAt && <div>Published at: {String(publishedInfo.publishedAt)}</div>}
          <div>Use Save Draft then Publish to update live config.</div>
        </div>
      )}
    </div>
  );
}
