"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { archivePages, bulkGeneratePages, publishPages, runQaForPages } from "@/app/(admin)/admin/actions";
import { Badge } from "./ui";

export type PageRow = {
  id: string;
  county?: { name?: string; slug?: string };
  city: { name: string; slug: string };
  neighborhood?: { name?: string; slug?: string };
  service: { name: string; slug: string };
  seo: { title: string };
  status: string;
  slugPath: string;
  quality?: { wordCount?: number; duplicationScore?: number; lastQaAt?: any };
  publishedAt?: any;
};

function statusTone(status: string) {
  if (status === "published") return "success";
  if (status === "review") return "warning";
  if (status === "draft") return "default";
  return "danger";
}

export function PagesTable({ pages }: { pages: PageRow[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const allSelected = selected.length === pages.length && pages.length > 0;

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleAll() {
    if (allSelected) {
      setSelected([]);
    } else {
      setSelected(pages.map((p) => p.id));
    }
  }

  const actions = [
    { label: "Generate", handler: () => bulkGeneratePages(selected) },
    { label: "Run QA", handler: () => runQaForPages(selected) },
    { label: "Publish", handler: () => publishPages(selected) },
    {
      label: "Archive",
      handler: () => {
        if (!window.confirm("Archive selected pages?")) return Promise.resolve();
        return archivePages(selected);
      },
    },
  ];

  function runAction(action: () => Promise<void>, label: string) {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      try {
        await action();
        setMessage(`${label} complete`);
      } catch (err: any) {
        setError(err?.message || `${label} failed`);
      }
    });
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
      <div className="flex flex-wrap gap-2 mb-4">
        {actions.map((a) => (
          <button
            key={a.label}
            className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:text-blue-700 text-sm"
            disabled={!selected.length || pending}
            onClick={() => runAction(a.handler, a.label)}
          >
            {pending ? "Working..." : a.label}
          </button>
        ))}
      </div>
      {(message || error) && (
        <div className={`text-sm ${error ? "text-rose-600" : "text-emerald-700"} mb-2`}>
          {error || message}
        </div>
      )}
      <table className="w-full text-sm">
        <thead>
          <tr className="text-slate-600 border-b border-slate-200">
            <th>
              <input type="checkbox" onChange={toggleAll} checked={allSelected} />
            </th>
            <th>Status</th>
            <th>Location</th>
            <th>Service</th>
            <th>Title</th>
            <th>Last QA</th>
            <th>Published</th>
          </tr>
        </thead>
        <tbody>
          {pages.map((p) => (
            <tr key={p.id} className="hover:bg-slate-50/80 border-b border-slate-100">
              <td>
                <input type="checkbox" checked={selected.includes(p.id)} onChange={() => toggle(p.id)} />
              </td>
              <td>
                <Badge tone={statusTone(p.status)}>{p.status}</Badge>
              </td>
              <td>
                <div className="font-medium text-slate-900">{p.neighborhood?.name || p.city.name}</div>
                <div className="text-xs text-slate-500">{[p.city.name, p.county?.name].filter(Boolean).join(", ")}</div>
              </td>
              <td>{p.service.name}</td>
              <td>
                <Link className="text-sky-700 hover:underline" href={`/admin/pages/${p.id}`}>
                  {p.seo?.title || `${p.service?.name} – ${p.neighborhood?.name || p.city?.name}` || p.slugPath}
                </Link>
              </td>
              <td className="text-slate-500 text-xs">
                {p.quality?.lastQaAt
                  ? new Date((p.quality.lastQaAt as any)._seconds ? (p.quality.lastQaAt as any)._seconds * 1000 : (p.quality.lastQaAt as any)).toLocaleDateString()
                  : "-"}
              </td>
              <td className="text-slate-500 text-xs">
                {p.publishedAt
                  ? new Date((p.publishedAt as any)._seconds ? (p.publishedAt as any)._seconds * 1000 : (p.publishedAt as any)).toLocaleDateString()
                  : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
