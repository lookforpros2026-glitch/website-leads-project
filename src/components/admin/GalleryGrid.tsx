"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { publishPages, unpublishPage } from "@/app/(admin)/admin/actions";
import { Badge } from "./ui";

type PageCard = {
  id: string;
  slugPath: string;
  viewPath?: string | null;
  status: string;
  seo?: { title?: string; canonical?: string };
  county?: { name?: string; slug?: string };
  city?: { name?: string; slug?: string };
  neighborhood?: { name?: string; slug?: string };
  service?: { name?: string; slug?: string };
  quality?: any;
  updatedAtMs?: number | null;
  createdAtMs?: number | null;
};

export function GalleryGrid({
  pages,
  hasMore,
  onLoadMore,
  loadingMore,
  refresh,
}: {
  pages: PageCard[];
  hasMore: boolean;
  onLoadMore: () => void;
  loadingMore: boolean;
  refresh?: () => void;
}) {
  const router = useRouter();
  const [pubPending, startTransition] = useTransition();

  function togglePublish(page: PageCard) {
    startTransition(async () => {
      if (page.status === "published") {
        await unpublishPage(page.id);
      } else {
        await publishPages([page.id]);
      }
      if (refresh) {
        refresh();
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
        {pages.map((p) => (
          <div key={p.id} className="relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md p-4 flex flex-col gap-3">
            <div className="absolute top-3 right-3 z-10">
              <span className="inline-flex max-w-[70%] items-center truncate rounded-full bg-emerald-400/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
                {p.status}
              </span>
            </div>
            <div className="flex flex-col gap-3 pr-16">
              <div className="flex items-start justify-between">
                {p.quality?.wordCount && <span className="text-xs text-slate-500">QA {p.quality.wordCount}w</span>}
              </div>
              <div className="space-y-1">
                <div className="text-base font-semibold text-slate-900 leading-tight">
                  {p.seo?.title || `${p.service?.name} ‚?" ${p.neighborhood?.name || p.city?.name}`}
                </div>
                <div className="text-xs text-slate-600 truncate">{p.viewPath || p.slugPath}</div>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                {(p.neighborhood?.name || p.city?.name) && <Badge>{p.neighborhood?.name || p.city?.name}</Badge>}
                {p.county?.name && <Badge>{p.county.name}</Badge>}
                {p.service?.name && <Badge>{p.service.name}</Badge>}
              </div>
              <div className="text-xs text-slate-500">Updated: {p.updatedAtMs ? new Date(p.updatedAtMs).toLocaleDateString() : "-"}</div>
              <div className="flex items-center justify-between gap-2 text-sm">
                <Link className="text-sky-700 hover:underline" href={`/admin/pages/edit/${encodeURIComponent(p.id)}`}>Edit</Link>
                <Link
                  className="text-slate-700 hover:underline"
                  href={p.viewPath || p.slugPath}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open
                </Link>
                <button
                  className="text-xs px-2 py-1 rounded border border-slate-200 hover:border-blue-200"
                  onClick={() => togglePublish(p)}
                  disabled={pubPending}
                >
                  {p.status === "published" ? "Unpublish" : "Publish"}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {hasMore && (
        <div className="flex justify-center">
          <button className="h-10 px-4 rounded-xl bg-blue-600 text-white text-sm hover:bg-blue-700 transition" disabled={loadingMore} onClick={onLoadMore}>
            {loadingMore ? "Loading..." : "Load more"}
          </button>
        </div>
      )}
      {!pages.length && (
        <div className="text-center text-slate-500 text-sm">No pages match these filters.</div>
      )}
      <div className="flex items-center justify-between text-sm text-slate-600 border-t border-slate-200 pt-3">
        <div className="flex items-center gap-2">
          <span>Rows per page:</span>
          <select className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm">
            <option>48</option>
            <option>96</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span>Showing {pages.length} items</span>
          <button className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-slate-700" disabled={!hasMore}>
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
