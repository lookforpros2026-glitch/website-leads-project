"use client";

import useSWRInfinite from "swr/infinite";
import { useMemo, useState, useCallback } from "react";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { jsonFetcher } from "@/lib/fetcher";
import { slugify } from "@/lib/slug";

type PageRow = {
  id: string;
  slug: string;
  city: string;
  service: string;
  status: "draft" | "published";
  qaScore: number | null;
  createdAtMs: number | null;
  updatedAtMs: number | null;
  viewPath?: string | null;
};

type PagesResponse = {
  items: PageRow[];
  nextCursor?: string;
};

function formatDate(ms: number | null) {
  if (!ms) return "-";
  return new Date(ms).toLocaleString();
}

export default function PagesTableClient() {
  const limit = 50;

  const [status, setStatus] = useState<string>("");
  const [sort, setSort] = useState<"updated" | "created">("updated");
  const [service, setService] = useState<string>("");
  const [city, setCity] = useState<string>("");
  const [q, setQ] = useState<string>("");
  const [countySlug, setCountySlug] = useState<string>("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  const qApplied = q.trim().length >= 2 ? q.trim() : "";
  const serviceApplied = service.trim() ? slugify(service.trim()) : "";
  const cityApplied = city.trim() ? slugify(city.trim()) : "";

  const baseUrl =
    `/api/admin/pages/table?limit=${limit}` +
    `&sort=${sort}` +
    (status ? `&status=${encodeURIComponent(status)}` : "") +
    (serviceApplied ? `&service=${encodeURIComponent(serviceApplied)}` : "") +
    (cityApplied ? `&city=${encodeURIComponent(cityApplied)}` : "") +
    (qApplied ? `&q=${encodeURIComponent(qApplied)}` : "");

  const getKey = (pageIndex: number, previousPageData: PagesResponse | null) => {
    if (pageIndex === 0) return baseUrl;
    if (!previousPageData?.nextCursor) return null;
    return `${baseUrl}&cursor=${previousPageData.nextCursor}`;
  };

  const { data, error, isLoading, size, setSize, isValidating, mutate } = useSWRInfinite<PagesResponse>(getKey, jsonFetcher, {
    revalidateFirstPage: false,
    keepPreviousData: true,
  });

  const items = useMemo(() => (data ? data.flatMap((p) => p.items) : []), [data]);
  const lastPage = data?.[data.length - 1];
  const canLoadMore = Boolean(lastPage?.nextCursor);

  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const selectedIds = useMemo(() => Object.keys(selected).filter((id) => selected[id]), [selected]);
  const selectedCount = selectedIds.length;
  const pageIdsOnScreen = useMemo(() => items.map((x) => x.id), [items]);
  const allOnScreenSelected = useMemo(() => {
    if (pageIdsOnScreen.length === 0) return false;
    return pageIdsOnScreen.every((id) => selected[id]);
  }, [pageIdsOnScreen, selected]);

  const toggleAllOnScreen = useCallback(() => {
    setSelected((prev) => {
      const next = { ...prev };
      const shouldSelect = !allOnScreenSelected;
      for (const id of pageIdsOnScreen) next[id] = shouldSelect;
      return next;
    });
  }, [allOnScreenSelected, pageIdsOnScreen]);

  async function runBulk(action: "publish" | "unpublish" | "qa", options?: { force?: boolean }) {
    if (selectedIds.length === 0) return;
    const res = await fetch("/api/admin/pages/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, pageIds: selectedIds, force: Boolean(options?.force) }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(text || `Bulk request failed: ${res.status}`);
    }
    await res.json().catch(() => ({}));
    setSelected({});
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Pages Table</h1>
          <p className="text-sm text-slate-600">Filter, QA, and publish programmatic pages at scale.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => mutate()}>
            Refresh
          </Button>
        </div>
      </div>

      <Panel className="p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setSize(1);
            }}
          >
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </Select>

          <Select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value as any);
              setSize(1);
            }}
          >
            <option value="updated">Sort: Updated</option>
            <option value="created">Sort: Created</option>
          </Select>

          <Input
            value={service}
            onChange={(e) => {
              setService(e.target.value);
              setSize(1);
            }}
            placeholder="Service slug (exact)"
          />

          <Input
            value={city}
            onChange={(e) => {
              setCity(e.target.value);
              setSize(1);
            }}
            placeholder="City slug (exact)"
          />

          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSize(1);
            }}
            placeholder="Search slug (prefix, 2+ chars)"
          />
        </div>

        <div className="mt-3 text-xs text-slate-500">
          Type at least 2 characters to search slug prefix (uses slugLower).
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-5">
          <Input
            value={countySlug}
            onChange={(e) => setCountySlug(e.target.value)}
            placeholder="County slug"
          />
          <Input
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            placeholder="From date (YYYY-MM-DD)"
          />
          <Input
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            placeholder="To date (YYYY-MM-DD)"
          />
          <Button
            variant="secondary"
            onClick={async () => {
              const ok = window.confirm("Publish pages matching these filters?");
              if (!ok) return;
              await fetch("/api/admin/pages/publish-by-filter", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "publish",
                  serviceKey: serviceApplied,
                  countySlug,
                  from: fromDate,
                  to: toDate,
                }),
              });
              await mutate();
            }}
          >
            Publish filtered
          </Button>
          <Button
            variant="secondary"
            onClick={async () => {
              const ok = window.confirm("Unpublish pages matching these filters?");
              if (!ok) return;
              await fetch("/api/admin/pages/publish-by-filter", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "unpublish",
                  serviceKey: serviceApplied,
                  countySlug,
                  from: fromDate,
                  to: toDate,
                }),
              });
              await mutate();
            }}
          >
            Unpublish filtered
          </Button>
        </div>
      </Panel>

      <Panel className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-slate-600">
            Selected: <span className="font-medium text-slate-900">{selectedCount}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              disabled={selectedCount === 0}
              onClick={async () => {
                try {
                  await runBulk("qa");
                } catch (e: any) {
                  alert(e?.message ?? "Failed to queue QA job");
                }
              }}
            >
              Run QA
            </Button>
            <Button
              variant="secondary"
              disabled={selectedCount === 0}
              onClick={async () => {
                try {
                  await runBulk("unpublish");
                } catch (e: any) {
                  alert(e?.message ?? "Failed to queue unpublish job");
                }
              }}
            >
              Unpublish
            </Button>
            <Button
              variant="primary"
              disabled={selectedCount === 0}
              onClick={async () => {
                try {
                  await runBulk("publish");
                } catch (e: any) {
                  alert(e?.message ?? "Failed to queue publish job");
                }
              }}
            >
              Publish
            </Button>
            <Button
              variant="secondary"
              disabled={selectedCount === 0}
              onClick={async () => {
                try {
                  await runBulk("publish", { force: true });
                } catch (e: any) {
                  alert(e?.message ?? "Failed to queue force publish job");
                }
              }}
            >
              Force Publish
            </Button>
          </div>
        </div>
      </Panel>

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          Failed to load pages. {String((error as any).message || error)}
        </div>
      )}

      <Panel className="overflow-hidden">
        <div className="grid grid-cols-14 border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-700">
          <div className="col-span-1">
            <input
              type="checkbox"
              checked={allOnScreenSelected}
              onChange={toggleAllOnScreen}
              className="h-4 w-4 rounded border-slate-300"
            />
          </div>
          <div className="col-span-4">Page</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2">QA</div>
          <div className="col-span-2">Updated</div>
          <div className="col-span-2">Created</div>
          <div className="col-span-1">Actions</div>
        </div>

        <div className="divide-y divide-slate-200">
          {(isLoading ? Array.from({ length: 10 }) : items).map((it: any, idx: number) => {
            if (!it) {
              return (
                <div key={idx} className="grid grid-cols-14 px-4 py-3">
                  <div className="col-span-1 h-3 w-4 rounded bg-slate-100" />
                  <div className="col-span-4 h-3 w-2/3 rounded bg-slate-100" />
                  <div className="col-span-2 h-3 w-1/2 rounded bg-slate-100" />
                  <div className="col-span-2 h-3 w-1/3 rounded bg-slate-100" />
                  <div className="col-span-2 h-3 w-2/3 rounded bg-slate-100" />
                  <div className="col-span-2 h-3 w-2/3 rounded bg-slate-100" />
                  <div className="col-span-1 h-3 w-1/3 rounded bg-slate-100" />
                </div>
              );
            }

            const safeViewPath = it.viewPath && !String(it.viewPath).includes("__") ? it.viewPath : null;

            return (
              <div key={it.id} className="grid grid-cols-14 items-center px-4 py-3 text-sm">
                <div className="col-span-1">
                  <input
                    type="checkbox"
                    checked={!!selected[it.id]}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setSelected((prev) => ({ ...prev, [it.id]: checked }));
                    }}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                </div>
                <div className="col-span-4">
                  <div className="font-medium text-slate-900">
                    {it.service} - {it.city}
                  </div>
                  <div className="text-xs text-slate-600">{it.viewPath || it.slug}</div>
                </div>

                <div className="col-span-2">
                  <Badge tone={it.status === "published" ? "success" : "neutral"}>{it.status}</Badge>
                </div>

                <div className="col-span-2 text-slate-900">{it.qaScore ?? "-"}</div>
                <div className="col-span-2 text-xs text-slate-700">{formatDate(it.updatedAtMs)}</div>
                <div className="col-span-2 text-xs text-slate-700">{formatDate(it.createdAtMs)}</div>
                <div className="col-span-1">
                  {safeViewPath ? (
                    <a
                      href={safeViewPath}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-700 hover:bg-white/10"
                    >
                      View
                    </a>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-600">
          Showing <span className="font-medium text-slate-900">{items.length}</span>
        </div>

        <Button variant="secondary" disabled={!canLoadMore || isValidating} onClick={() => setSize(size + 1)}>
          {isValidating ? "Loading..." : canLoadMore ? "Load more" : "No more pages"}
        </Button>
      </div>
    </div>
  );
}
