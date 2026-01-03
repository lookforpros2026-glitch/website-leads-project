"use client";

import useSWR from "swr";
import { useMemo, useState } from "react";
import { jsonFetcher } from "@/lib/fetcher";

type LeadDetail = {
  id: string;
  createdAtMs: number;
  source?: { slug?: string; service?: string; city?: string };
  contact?: { name?: string; phone?: string; email?: string };
  consent?: { sms?: boolean; tsMs?: number };
  answers?: Record<string, any>;
  estimate?: { low?: number; typical?: number; high?: number; confidence?: string };
  status: "new" | "contacted" | "won" | "lost";
  assignedTo?: string | null;
  notes: Array<{ id: string; tsMs: number; text: string; author?: string }>;
};

type ContractorsResponse = { ok: boolean; contractors: Array<{ id: string; name: string; email?: string | null }> };

const STATUS_OPTIONS: LeadDetail["status"][] = ["new", "contacted", "won", "lost"];

function shortId(id: string) {
  return id.slice(0, 8);
}

function formatDate(ms?: number | null) {
  if (!ms) return "-";
  return new Date(ms).toLocaleString();
}

export function LeadDetailClient({ leadId }: { leadId: string }) {
  const { data, error, isLoading, mutate } = useSWR<LeadDetail>(`/api/admin/leads/${leadId}`, jsonFetcher, {
    revalidateOnFocus: false,
  });
  const { data: contractors } = useSWR<ContractorsResponse>(`/api/admin/contractors?active=true`, jsonFetcher, {
    revalidateOnFocus: false,
  });

  const [statusSaving, setStatusSaving] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);
  const [assignSaving, setAssignSaving] = useState(false);
  const [note, setNote] = useState("");

  const lead = data;
  const contractorOptions = contractors?.contractors ?? [];

  async function updateStatus(next: LeadDetail["status"]) {
    if (!lead) return;
    setStatusSaving(true);
    mutate((prev) => (prev ? { ...prev, status: next } : prev), false);
    try {
      const res = await fetch(`/api/admin/leads/${leadId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error("Status update failed");
      await mutate();
    } catch {
      await mutate();
    } finally {
      setStatusSaving(false);
    }
  }

  async function updateAssignment(next: string | null) {
    if (!lead) return;
    setAssignSaving(true);
    mutate((prev) => (prev ? { ...prev, assignedTo: next } : prev), false);
    try {
      const res = await fetch(`/api/admin/leads/${leadId}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedTo: next }),
      });
      if (!res.ok) throw new Error("Assign failed");
      await mutate();
    } catch {
      await mutate();
    } finally {
      setAssignSaving(false);
    }
  }

  async function addNote() {
    const trimmed = note.trim();
    if (!trimmed || !lead) return;
    setNoteSaving(true);
    const optimistic = { id: `tmp-${Date.now()}`, tsMs: Date.now(), text: trimmed };
    mutate((prev) => (prev ? { ...prev, notes: [optimistic, ...(prev.notes || [])] } : prev), false);
    try {
      const res = await fetch(`/api/admin/leads/${leadId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });
      if (!res.ok) throw new Error("Note failed");
      const json = await res.json().catch(() => null);
      const created = json?.note;
      mutate(
        (prev) =>
          prev
            ? {
                ...prev,
                notes: created
                  ? [created, ...(prev.notes || []).filter((n) => n.id !== optimistic.id)]
                  : prev.notes,
              }
            : prev,
        false
      );
      setNote("");
    } catch {
      await mutate();
    } finally {
      setNoteSaving(false);
    }
  }

  const infoBlocks = useMemo(() => {
    if (!lead) return [];
    const answersCount = lead.answers ? Object.keys(lead.answers).length : 0;
    return [
      { label: "Name", value: lead.contact?.name || "-" },
      { label: "Phone", value: lead.contact?.phone || "-" },
      { label: "Email", value: lead.contact?.email || "-" },
      {
        label: "Source",
        value: [lead.source?.service || null, lead.source?.city || null, lead.source?.slug || null]
          .filter(Boolean)
          .join(" / ") || "-",
      },
      {
        label: "Estimate",
        value: lead.estimate
          ? [lead.estimate.low, lead.estimate.typical, lead.estimate.high]
              .filter((v) => typeof v === "number")
              .map((v) => `$${v}`)
              .join(" - ") || "---"
          : "---",
        helper: lead.estimate?.confidence,
      },
      {
        label: "Consent",
        value: lead.consent ? (lead.consent.sms ? "SMS consented" : "No SMS consent") : "Unknown",
        helper: lead.consent?.tsMs ? `At ${formatDate(lead.consent.tsMs)}` : undefined,
      },
      { label: "Answers", value: answersCount ? `${answersCount} response${answersCount === 1 ? "" : "s"}` : "None" },
    ];
  }, [lead]);

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="mx-auto max-w-5xl space-y-4">
          <div className="h-24 rounded-xl bg-slate-100" />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="h-40 rounded-xl bg-slate-100" />
            <div className="h-40 rounded-xl bg-slate-100" />
          </div>
          <div className="h-56 rounded-xl bg-slate-100" />
          <div className="h-72 rounded-xl bg-slate-100" />
        </div>
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className="p-6">
        <div className="mx-auto max-w-3xl rounded-xl border border-rose-200 bg-rose-50 px-4 py-6 text-slate-900">
          <div className="text-lg font-semibold text-rose-800">Lead failed to load</div>
          <p className="mt-2 text-sm text-rose-700">Please try again.</p>
          <button
            onClick={() => mutate()}
            className="mt-3 inline-flex rounded-lg bg-rose-700 px-4 py-2 text-sm font-medium text-white hover:bg-rose-800"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-medium text-slate-600">Lead #{shortId(lead.id)}</div>
              <div className="text-2xl font-semibold text-slate-900">Lead detail</div>
              <div className="text-sm text-slate-600">Created {formatDate(lead.createdAtMs)}</div>
            </div>
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-medium capitalize text-slate-800">
              {lead.status}
            </span>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900">Status</div>
                <div className="text-xs text-slate-600">Update lifecycle</div>
              </div>
              <select
                value={lead.status}
                onChange={(e) => updateStatus(e.target.value as LeadDetail["status"])}
                disabled={statusSaving}
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt.charAt(0).toUpperCase() + opt.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900">Assignment</div>
                <div className="text-xs text-slate-600">Reassign contractor</div>
              </div>
              <select
                value={lead.assignedTo ?? ""}
                onChange={(e) => updateAssignment(e.target.value || null)}
                disabled={assignSaving}
                className="h-10 min-w-[180px] rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900"
              >
                <option value="">Unassigned</option>
                {contractorOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-900">Lead info</div>
              <div className="text-xs text-slate-600">Contact, source, estimate</div>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {infoBlocks.map((block) => (
              <div key={block.label} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                <div className="text-xs uppercase tracking-wide text-slate-500">{block.label}</div>
                <div className="mt-1 text-sm font-medium text-slate-900">{block.value}</div>
                {block.helper && <div className="text-xs text-slate-500">{block.helper}</div>}
              </div>
            ))}
          </div>
          {lead.answers && Object.keys(lead.answers).length > 0 && (
            <div className="mt-4 rounded-lg border border-slate-100 bg-white p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">Answers</div>
              <div className="mt-2 space-y-2">
                {Object.entries(lead.answers).map(([k, v]) => (
                  <div key={k} className="rounded border border-slate-100 bg-slate-50 p-2 text-sm text-slate-900">
                    <div className="text-xs uppercase tracking-wide text-slate-500">{k}</div>
                    <div className="mt-1 break-words text-slate-900">{String(v)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-900">Notes</div>
              <div className="text-xs text-slate-600">Append-only timeline</div>
            </div>
          </div>

          <div className="mt-3 flex items-start gap-3">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Add note..."
              className="w-full rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-900 placeholder:text-slate-500"
            />
            <button
              onClick={addNote}
              disabled={noteSaving || !note.trim()}
              className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              Add note
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {(lead.notes || []).map((n) => (
              <div key={n.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>{n.author || "Admin"}</span>
                  <span>{formatDate(n.tsMs)}</span>
                </div>
                <div className="mt-1 whitespace-pre-wrap text-sm text-slate-900">{n.text}</div>
              </div>
            ))}
            {(!lead.notes || lead.notes.length === 0) && <div className="text-sm text-slate-600">No notes yet.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
