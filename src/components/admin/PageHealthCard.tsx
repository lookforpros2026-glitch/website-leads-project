"use client";

import useSWR from "swr";
import { useState } from "react";
import Link from "next/link";
import { jsonFetcher } from "@/lib/fetcher";
import { CardShell } from "@/components/admin/ui";

type HealthSummary = {
  totals: {
    total: number;
    scanned: number;
    warn: number;
    fail: number;
    missing: number;
    duplicates: number;
  };
  topMissing: Array<{ key: string; count: number }>;
  topDuplicates: Array<{ key: string; count: number }>;
  lastScanAt: number | null;
};

type HealthJobStatus = {
  status: string;
  progress: { done: number; total: number; percent: number };
  output?: { scanned?: number; updated?: number; warns?: number; fails?: number };
};

export default function PageHealthCard() {
  const { data, mutate, isLoading } = useSWR<HealthSummary>("/api/admin/pages/health/summary", jsonFetcher);
  const [jobId, setJobId] = useState<string | null>(null);
  const { data: jobStatus } = useSWR<HealthJobStatus>(
    jobId ? `/api/admin/pages/health/status?jobId=${encodeURIComponent(jobId)}` : null,
    jsonFetcher,
    { refreshInterval: (latest) => (latest?.status === "running" || latest?.status === "queued" ? 1500 : 0) }
  );

  const scan = async (payload: { scope: string; zip?: string; serviceKey?: string }) => {
    const res = await fetch("/api/admin/pages/health/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (json?.jobId) {
      setJobId(json.jobId);
    }
  };

  const lastScan = data?.lastScanAt ? new Date(data.lastScanAt).toLocaleString() : "Never";
  const progress = jobStatus?.progress;

  return (
    <CardShell className="p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-neutral-900">Page health</div>
          <p className="text-sm text-neutral-600">QA warnings, duplication, and missing sections</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void scan({ scope: "all" })}
            className="h-9 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-800"
          >
            Scan now
          </button>
          <button
            onClick={() => {
              const nextZip = window.prompt("Enter ZIP to scan:");
              if (nextZip) void scan({ scope: "zip", zip: nextZip.trim() });
            }}
            className="h-9 rounded-lg border border-slate-200 px-3 text-xs text-slate-700 hover:border-slate-300"
          >
            Scan ZIP
          </button>
          <button
            onClick={() => {
              const nextService = window.prompt("Enter service key to scan:");
              if (nextService) void scan({ scope: "serviceKey", serviceKey: nextService.trim() });
            }}
            className="h-9 rounded-lg border border-slate-200 px-3 text-xs text-slate-700 hover:border-slate-300"
          >
            Scan service
          </button>
        </div>
      </div>

      {jobStatus && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
          <div>Status: {jobStatus.status}</div>
          {progress && (
            <div>
              Progress: {progress.done}/{progress.total} ({progress.percent || 0}%)
            </div>
          )}
        </div>
      )}

      <ul className="space-y-2 text-sm text-neutral-700">
        <li>- QA fails: {isLoading ? "Loading..." : data?.totals.fail ?? 0}</li>
        <li>- Duplicate warnings: {isLoading ? "Loading..." : data?.totals.duplicates ?? 0}</li>
        <li>- Missing required sections: {isLoading ? "Loading..." : data?.totals.missing ?? 0}</li>
      </ul>

      {!isLoading && (
        <div className="grid gap-3 text-xs text-neutral-600 sm:grid-cols-2">
          <div>
            <div className="font-semibold text-neutral-800">Top missing</div>
            <ul className="mt-2 space-y-1">
              {(data?.topMissing || []).map((item) => (
                <li key={item.key}>
                  {item.key}: {item.count}
                </li>
              ))}
              {!data?.topMissing?.length && <li>None</li>}
            </ul>
          </div>
          <div>
            <div className="font-semibold text-neutral-800">Top duplicates</div>
            <ul className="mt-2 space-y-1">
              {(data?.topDuplicates || []).map((item) => (
                <li key={item.key}>
                  {item.key}: {item.count}
                </li>
              ))}
              {!data?.topDuplicates?.length && <li>None</li>}
            </ul>
          </div>
        </div>
      )}

      <div className="text-xs text-neutral-500">Last scan: {lastScan}</div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-700">
        <Link href="/admin/pages/health" className="text-sky-700 hover:underline">
          View failures
        </Link>
        <span>·</span>
        <Link href="/admin/pages/health?status=warn" className="text-sky-700 hover:underline">
          View warnings
        </Link>
        <span>·</span>
        <Link href="/admin/pages/health?duplicateSection=hero" className="text-sky-700 hover:underline">
          View duplicates
        </Link>
        <span>·</span>
        <a
          href="/api/admin/pages/health/list?status=fail&format=csv"
          className="text-sky-700 hover:underline"
        >
          Export fails
        </a>
        <span>·</span>
        <button onClick={() => void mutate()} className="text-slate-600 hover:text-slate-800">
          Refresh
        </button>
      </div>

      {!isLoading && (
        <div className="text-xs text-neutral-500">
          Scanned: {data?.totals.scanned ?? 0}/{data?.totals.total ?? 0}
        </div>
      )}
    </CardShell>
  );
}
