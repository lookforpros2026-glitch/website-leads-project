"use client";

import useSWR from "swr";
import { useMemo, useState } from "react";
import { jsonFetcher } from "@/lib/fetcher";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { useBreakpoint } from "@/lib/useBreakpoint";
import { Skeleton } from "@/components/admin/ui/Skeleton";

type LeadDetail = {
  id: string;
  fullName?: string;
  phone?: string;
  email?: string | null;
  pageSlug?: string;
  slugPath?: string;
  serviceKey?: string;
  serviceName?: string;
  estimateMin?: number | null;
  estimateMax?: number | null;
  estimateMid?: number | null;
  estimateConfidence?: string | null;
  durationMinDays?: number | null;
  durationMaxDays?: number | null;
  estimatorVersion?: string | null;
  estimatorConfigId?: string | null;
  referrer?: string | null;
  utm?: any | null;
  source?: { type?: string; docId?: string; url?: string } | null;
  contact?: { name?: string; phone?: string; email?: string };
  status: "new" | "contacted" | "booked" | "closed" | "spam";
  message: string | null;
  answers: any | null;
  userAgent?: string | null;
  ip?: string | null;
  createdAtMs: number | null;
  updatedAtMs: number | null;
  statusUpdatedAtMs: number | null;
  notes: Array<{ atMs: number | null; text: string }>;
};

function formatDate(ms: number | null) {
  if (!ms) return "-";
  return new Date(ms).toLocaleString();
}

function formatCurrency(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return value.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function formatDuration(minDays?: number | null, maxDays?: number | null) {
  if (typeof minDays !== "number" || typeof maxDays !== "number") return "—";
  if (minDays >= 14 || maxDays >= 14) {
    const minWeeks = Math.max(1, Math.round(minDays / 7));
    const maxWeeks = Math.max(minWeeks, Math.round(maxDays / 7));
    return `${minWeeks}–${maxWeeks} weeks`;
  }
  return `${minDays}–${maxDays} days`;
}

function safeText(value?: string | null) {
  return value && value.trim() ? value : "—";
}

async function patchLead(id: string, payload: any) {
  const res = await fetch(`/api/admin/leads/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `PATCH failed: ${res.status}`);
  }
  return res.json().catch(() => ({}));
}

export default function LeadDetailDrawer({
  leadId,
  open,
  onClose,
  onUpdated,
}: {
  leadId: string | null;
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const { data, error, isLoading, mutate } = useSWR<LeadDetail>(
    open && leadId ? `/api/admin/leads/${leadId}` : null,
    jsonFetcher,
    { revalidateOnFocus: false }
  );

  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");
  const { isMobile } = useBreakpoint();

  const title = useMemo(() => {
    if (!data) return "Lead";
    return data.fullName || data.contact?.name || "Lead";
  }, [data]);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore clipboard failures
    }
  }

  async function updateStatus(next: LeadDetail["status"]) {
    if (!leadId) return;
    setSaving(true);
    try {
      await patchLead(leadId, { status: next });
      await mutate();
      onUpdated();
    } finally {
      setSaving(false);
    }
  }

  async function addNote() {
    if (!leadId) return;
    const trimmed = note.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await patchLead(leadId, { note: trimmed });
      setNote("");
      await mutate();
      onUpdated();
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  const estimateMin =
    data?.estimateMin ??
    (data as any)?.estimate?.low ??
    null;
  const estimateMax =
    data?.estimateMax ??
    (data as any)?.estimate?.high ??
    null;
  const estimateConfidence =
    data?.estimateConfidence ??
    (data as any)?.estimate?.confidence ??
    null;

  return (
    <div className="fixed inset-0 z-50">
      <button className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-label="Close" onClick={onClose} />
      <div
        className={
          isMobile
            ? "absolute bottom-0 left-0 right-0 flex max-h-[85vh] flex-col rounded-t-3xl border-t border-slate-800 bg-slate-950 text-slate-100 shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_24px_60px_rgba(0,0,0,0.55)]"
            : "absolute right-0 top-0 flex h-dvh w-full max-w-lg flex-col border-l border-slate-800 bg-slate-950 text-slate-100 shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_24px_60px_rgba(0,0,0,0.55)]"
        }
      >
        {isMobile && <div className="mx-auto mt-3 h-1 w-12 rounded-full bg-white/20" />}
        <div className="flex items-start justify-between border-b border-slate-800 px-5 py-4">
          <div>
            <div className="text-sm font-semibold text-slate-100">{title}</div>
            <div className="mt-1 text-xs text-slate-400">
              {data?.pageSlug ?? "-"} - Created {formatDate(data?.createdAtMs ?? null)}
            </div>
          </div>
          <Button variant="secondary" className="border-slate-700 bg-slate-900/50 text-slate-100 hover:bg-slate-900" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {error && (
            <div className="mb-4 rounded-md border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              Failed to load lead.
            </div>
          )}

          {isLoading && (
            <div className="space-y-3">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-24 w-full rounded-2xl" />
            </div>
          )}

          {data && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/40">
                <div className="p-4 space-y-4">
                  <div>
                    <div className="text-xs font-medium text-slate-300">Estimate summary</div>
                    <div className="mt-1 text-xs text-slate-500">
                      Estimator {safeText(data.estimatorVersion)} {data.estimatorConfigId ? `(${data.estimatorConfigId})` : ""}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs text-slate-500">Service</div>
                        <div className="text-slate-100">
                          {safeText(data.serviceName || data.serviceKey)}
                          {data.serviceKey && data.serviceName ? ` (${data.serviceKey})` : ""}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs text-slate-500">Estimate range</div>
                        <div className="text-slate-100">
                          {formatCurrency(estimateMin)} – {formatCurrency(estimateMax)}
                        </div>
                        <div className="text-xs text-slate-500">
                          Confidence: {safeText(estimateConfidence)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs text-slate-500">Estimated duration</div>
                        <div className="text-slate-100">
                          {formatDuration(data.durationMinDays, data.durationMaxDays)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs text-slate-500">Source page</div>
                        <div className="text-slate-100 break-words">{safeText(data.slugPath || data.pageSlug)}</div>
                        <div className="text-xs text-slate-500 mt-1">
                          Doc ID: {safeText(data.source?.docId)}
                        </div>
                      </div>
                      {(data.slugPath || data.pageSlug) && (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="border-slate-700 bg-slate-900/50 text-slate-100 hover:bg-slate-900"
                          onClick={() => {
                            const path = data.slugPath || data.pageSlug || "";
                            if (!path) return;
                            window.open(path, "_blank");
                          }}
                        >
                          Open
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/40">
                <div className="p-4">
                  <div className="text-xs font-medium text-slate-300">Contact</div>

                  <div className="mt-3 grid grid-cols-1 gap-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs text-slate-500">Phone</div>
                        <div className="text-slate-100">{safeText(data.phone || data.contact?.phone)}</div>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="border-slate-700 bg-slate-900/50 text-slate-100 hover:bg-slate-900"
                        onClick={() => {
                          const phone = data.phone || data.contact?.phone || "";
                          if (phone) copy(phone);
                        }}
                      >
                        Copy
                      </Button>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs text-slate-500">Email</div>
                        <div className="text-slate-100">{safeText(data.email || data.contact?.email)}</div>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="border-slate-700 bg-slate-900/50 text-slate-100 hover:bg-slate-900"
                        disabled={!data.email && !data.contact?.email}
                        onClick={() => {
                          const email = data.email || data.contact?.email || "";
                          if (email) copy(email);
                        }}
                      >
                        Copy
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/40">
                <div className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-medium text-slate-300">Status</div>
                      <div className="mt-1 text-xs text-slate-500">Last updated: {formatDate(data.statusUpdatedAtMs)}</div>
                    </div>

                    <Select
                      value={data.status}
                      disabled={saving}
                      onChange={(e) => updateStatus(e.target.value as LeadDetail["status"])}
                      className="w-40 border-slate-700 bg-slate-950/60 text-slate-100 focus:ring-slate-700"
                    >
                      <option value="new">New</option>
                      <option value="contacted">Contacted</option>
                      <option value="booked">Booked</option>
                      <option value="closed">Closed</option>
                      <option value="spam">Spam</option>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/40">
                <div className="p-4">
                  <div className="text-xs font-medium text-slate-300">Message</div>
                  <div className="mt-2 whitespace-pre-wrap text-sm text-slate-100">{data.message ?? "-"}</div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/40">
                <div className="p-4">
                  <div className="text-xs font-medium text-slate-300">Attribution</div>
                  <div className="mt-2 grid grid-cols-1 gap-2 text-sm text-slate-100">
                    <div>
                      <div className="text-xs text-slate-500">Referrer</div>
                      <div className="break-words">{safeText(data.referrer)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">UTM</div>
                      {data.utm && Object.keys(data.utm || {}).length > 0 ? (
                        <pre className="mt-1 overflow-auto rounded-md border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-200">
{JSON.stringify(data.utm ?? null, null, 2)}
                        </pre>
                      ) : (
                        <div className="text-xs text-slate-500">—</div>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">User agent: {data.userAgent ?? "-"}</div>
                    <div className="text-xs text-slate-500">IP: {data.ip ?? "-"}</div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/40">
                <div className="p-4">
                  <div className="text-xs font-medium text-slate-300">Notes</div>

                  <div className="mt-3 flex items-start gap-2">
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={3}
                      placeholder="Add a note..."
                      className="w-full rounded-xl border border-slate-800 bg-slate-950/60 p-2 text-sm text-slate-100 placeholder:text-slate-500"
                    />
                    <Button variant="secondary" className="border-slate-700 bg-slate-900/50 text-slate-100 hover:bg-slate-900" disabled={saving || !note.trim()} onClick={addNote}>
                      Add
                    </Button>
                  </div>

                  <div className="mt-4 space-y-2">
                    {(Array.isArray(data.notes) ? data.notes : []).slice().reverse().map((n, idx) => (
                      <div key={idx} className="rounded-md border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-100">
                        <div className="flex items-center justify-between">
                          <div className="text-xs text-slate-500">Note</div>
                          <div className="text-xs text-slate-500">{formatDate(n.atMs)}</div>
                        </div>
                        <div className="mt-1 whitespace-pre-wrap">{n.text}</div>
                      </div>
                    ))}
                    {(!data.notes || data.notes.length === 0) && <div className="text-sm text-slate-500">No notes yet.</div>}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
