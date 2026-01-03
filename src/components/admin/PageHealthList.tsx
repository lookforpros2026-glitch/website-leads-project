"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { jsonFetcher } from "@/lib/fetcher";

type HealthItem = {
  id: string;
  slugPath: string;
  zip: string;
  serviceKey: string;
  healthStatus: string | null;
  missingCount: number;
  qaFailCount: number;
  duplicateCount: number;
  scannedAtMs: number | null;
};

type HealthListResponse = { items: HealthItem[]; nextCursor?: string };

export default function PageHealthList() {
  const [status, setStatus] = useState<string>("fail");
  const [missingSection, setMissingSection] = useState("");
  const [duplicateSection, setDuplicateSection] = useState("");
  const [serviceKey, setServiceKey] = useState("");
  const [zip, setZip] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [items, setItems] = useState<HealthItem[]>([]);

  const query = useMemo(() => {
    const qs = new URLSearchParams();
    if (status) qs.set("status", status);
    if (missingSection) qs.set("missingSection", missingSection);
    if (duplicateSection) qs.set("duplicateSection", duplicateSection);
    if (serviceKey) qs.set("serviceKey", serviceKey);
    if (zip) qs.set("zip", zip);
    if (cursor) qs.set("cursor", cursor);
    qs.set("limit", "50");
    return `/api/admin/pages/health/list?${qs.toString()}`;
  }, [cursor, duplicateSection, missingSection, serviceKey, status, zip]);

  const { data, isLoading } = useSWR<HealthListResponse>(query, jsonFetcher, {
    onSuccess: (resp) => {
      if (!cursor) setItems(resp.items);
      else setItems((prev) => [...prev, ...resp.items]);
    },
  });

  const resetAndFetch = () => {
    setCursor(null);
    setItems([]);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-5">
          <label className="text-xs text-slate-600">
            Status
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                resetAndFetch();
              }}
              className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1 text-sm"
            >
              <option value="">Any</option>
              <option value="fail">Fail</option>
              <option value="warn">Warn</option>
              <option value="ok">Ok</option>
            </select>
          </label>
          <label className="text-xs text-slate-600">
            Missing section
            <input
              value={missingSection}
              onChange={(e) => setMissingSection(e.target.value)}
              onBlur={resetAndFetch}
              placeholder="intro"
              className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1 text-sm"
            />
          </label>
          <label className="text-xs text-slate-600">
            Duplicate section
            <input
              value={duplicateSection}
              onChange={(e) => setDuplicateSection(e.target.value)}
              onBlur={resetAndFetch}
              placeholder="hero"
              className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1 text-sm"
            />
          </label>
          <label className="text-xs text-slate-600">
            Service key
            <input
              value={serviceKey}
              onChange={(e) => setServiceKey(e.target.value)}
              onBlur={resetAndFetch}
              placeholder="roofing"
              className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1 text-sm"
            />
          </label>
          <label className="text-xs text-slate-600">
            ZIP
            <input
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              onBlur={resetAndFetch}
              placeholder="90001"
              className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1 text-sm"
            />
          </label>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-2 text-xs text-slate-500">
          {isLoading ? "Loading..." : `${items.length} pages`}
        </div>
        <div className="divide-y divide-slate-100">
          {items.map((item) => (
            <div key={item.id} className="px-4 py-3 text-sm">
              <div className="flex items-center justify-between">
                <div className="font-medium text-slate-900">{item.slugPath || item.id}</div>
                <div className="text-xs text-slate-500">
                  {item.scannedAtMs ? new Date(item.scannedAtMs).toLocaleDateString() : "Not scanned"}
                </div>
              </div>
              <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-600">
                <span>Status: {item.healthStatus || "-"}</span>
                <span>Missing: {item.missingCount}</span>
                <span>QA fails: {item.qaFailCount}</span>
                <span>Duplicates: {item.duplicateCount}</span>
                {item.zip && <span>ZIP: {item.zip}</span>}
                {item.serviceKey && <span>Service: {item.serviceKey}</span>}
              </div>
            </div>
          ))}
          {!isLoading && items.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-slate-500">No matching pages.</div>
          )}
        </div>
        {data?.nextCursor && (
          <div className="border-t border-slate-200 px-4 py-3">
            <button
              onClick={() => setCursor(data.nextCursor || null)}
              className="rounded-md border border-slate-200 px-3 py-1 text-xs text-slate-700 hover:border-slate-300"
            >
              Load more
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
