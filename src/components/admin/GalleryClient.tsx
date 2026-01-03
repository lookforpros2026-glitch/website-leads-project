"use client";

import useSWRInfinite from "swr/infinite";
import { jsonFetcher } from "@/lib/fetcher";
import { slugify } from "@/lib/slug";
import { useMemo, useState } from "react";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { useRouter } from "next/navigation";

type Card = {
  id: string;
  slug: string;
  city: string;
  service: string;
  citySlug?: string | null;
  serviceSlug?: string | null;
  viewPath?: string | null;
  status: "draft" | "published";
  qaScore: number | null;
  updatedAtMs: number | null;
  createdAtMs: number | null;
};

type GalleryResponse = { items: Card[]; nextCursor?: string };

function formatDate(ms: number | null) {
  if (!ms) return "-";
  return new Date(ms).toLocaleString();
}

export default function GalleryClient() {
  const limit = 24;
  const router = useRouter();

  const [sort, setSort] = useState<"updated" | "created">("updated");
  const [status, setStatus] = useState<string>("");
  const [service, setService] = useState<string>("");
  const [city, setCity] = useState<string>("");
  const [q, setQ] = useState<string>("");

  const qApplied = q.trim().length >= 2 ? q.trim() : "";
  const serviceApplied = service.trim() ? slugify(service.trim()) : "";
  const cityApplied = city.trim() ? slugify(city.trim()) : "";

  const baseUrl =
    `/api/admin/pages/gallery?limit=${limit}` +
    `&sort=${sort}` +
    (status ? `&status=${encodeURIComponent(status)}` : "") +
    (serviceApplied ? `&service=${encodeURIComponent(serviceApplied)}` : "") +
    (cityApplied ? `&city=${encodeURIComponent(cityApplied)}` : "") +
    (qApplied ? `&q=${encodeURIComponent(qApplied)}` : "");

  const getKey = (pageIndex: number, prev: GalleryResponse | null) => {
    if (pageIndex === 0) return baseUrl;
    if (!prev?.nextCursor) return null;
    return `${baseUrl}&cursor=${prev.nextCursor}`;
  };

  const { data, error, isLoading, size, setSize, isValidating, mutate } = useSWRInfinite<GalleryResponse>(getKey, jsonFetcher, {
    revalidateFirstPage: false,
    keepPreviousData: true,
  });

  const items = useMemo(() => {
    const raw = data ? data.flatMap((p) => p.items) : [];
    return raw.map((it) => {
      const serviceLabel =
        typeof it.service === "object"
          ? (it.service as any)?.name || (it.service as any)?.slug || ""
          : it.service || "";
      const cityLabel =
        typeof it.city === "object"
          ? (it.city as any)?.name || (it.city as any)?.slug || ""
          : it.city || "";

      return {
        ...it,
        serviceLabel,
        cityLabel,
      };
    });
  }, [data]);

  const onView = (item: Card & { serviceLabel?: string; cityLabel?: string }) => {
    const viewPath = item.viewPath?.trim() || "";
    if (viewPath) {
      window.open(viewPath, "_blank", "noopener,noreferrer");
      return;
    }
    alert("Missing canonical URL for this page.");
  };

  const onEdit = (item: Card) => {
    router.push(`/admin/pages/edit/${encodeURIComponent(item.id)}`);
  };

  const onDelete = async (item: Card) => {
    const ok = confirm(`Delete page "${item.slug}"? This cannot be undone.`);
    if (!ok) return;
    const res = await fetch(`/api/admin/pages/${item.id}`, { method: "DELETE" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(json?.error || "Failed to delete.");
      return;
    }
    mutate(); // refresh gallery data
  };
  const lastPage = data?.[data.length - 1];
  const canLoadMore = Boolean(lastPage?.nextCursor);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Pages Gallery</h1>
          <p className="text-sm text-slate-600">Visual scan of pages. Filter and load more instantly.</p>
        </div>
        <Button variant="secondary" onClick={() => mutate()}>
          Refresh
        </Button>
      </div>

      <Panel className="p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
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
      </Panel>

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          Failed to load gallery.
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {(isLoading ? Array.from({ length: 12 }) : items).map((it: any, idx: number) => {
          if (!it) {
            return <div key={idx} className="h-28 rounded-lg border border-slate-200 bg-white shadow-sm" />;
          }

          const tone = it.status === "published" ? "success" : "neutral";

          return (
            <Panel key={it.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-slate-900">
                    {it.serviceLabel} - {it.cityLabel}
                  </div>
                  <div className="mt-1 text-xs text-slate-600">{String(it.viewPath || it.slug || "")}</div>
                </div>
                <Badge tone={tone as any}>{it.status}</Badge>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-700">
                <div>
                  <div className="text-slate-500">QA</div>
                  <div className="text-slate-900">{it.qaScore ?? "-"}</div>
                </div>
                <div>
                  <div className="text-slate-500">Updated</div>
                  <div className="text-slate-900">{formatDate(it.updatedAtMs)}</div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-end gap-2">
                <Button size="sm" variant="secondary" onClick={() => onView(it as any)}>
                  View
                </Button>
                <Button size="sm" variant="secondary" onClick={() => onEdit(it as any)}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="border-rose-200 text-rose-700 hover:bg-rose-50"
                  onClick={() => onDelete(it as any)}
                >
                  Delete
                </Button>
              </div>
            </Panel>
          );
        })}
      </div>

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
