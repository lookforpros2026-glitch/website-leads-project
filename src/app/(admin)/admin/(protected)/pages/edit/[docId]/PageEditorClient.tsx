"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

type PageEditorProps = {
  docId: string;
  initial: any;
};

type SeoFields = {
  title: string;
  description: string;
  h1: string;
  canonical: string;
  index: boolean;
};

export default function PageEditorClient({ docId, initial }: PageEditorProps) {
  const initialSeo = initial?.seo || {};
  const [status, setStatus] = useState<string>(initial?.status || "draft");
  const [seo, setSeo] = useState<SeoFields>({
    title: initialSeo.title || "",
    description: initialSeo.description || "",
    h1: initialSeo.h1 || "",
    canonical: initialSeo.canonical || "",
    index: initialSeo.index !== false,
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const dirty = useMemo(() => {
    const initialStatus = initial?.status || "draft";
    const initSeo: SeoFields = {
      title: initialSeo.title || "",
      description: initialSeo.description || "",
      h1: initialSeo.h1 || "",
      canonical: initialSeo.canonical || "",
      index: initialSeo.index !== false,
    };
    return (
      status !== initialStatus ||
      seo.title !== initSeo.title ||
      seo.description !== initSeo.description ||
      seo.h1 !== initSeo.h1 ||
      seo.canonical !== initSeo.canonical ||
      seo.index !== initSeo.index
    );
  }, [initial, initialSeo, seo, status]);

  const slugPath = initial?.slugPath || "";
  const updatedAt = initial?.updatedAt?.toDate?.() || null;

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/pages/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          docId,
          patch: {
            status,
            seo: {
              title: seo.title.trim(),
              description: seo.description.trim(),
              h1: seo.h1.trim(),
              canonical: seo.canonical.trim(),
              index: seo.index,
            },
          },
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        setMessage(json?.error || "Save failed.");
        return;
      }
      setMessage("Saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-24">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-lg font-semibold text-slate-100">Edit Page</div>
          <div className="text-xs text-slate-400">{docId}</div>
          {slugPath && <div className="text-xs text-slate-500">Slug: {slugPath}</div>}
          {updatedAt && <div className="text-xs text-slate-500">Updated: {updatedAt.toLocaleString()}</div>}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => window.history.back()}>
            Back
          </Button>
          <Button variant="primary" disabled={!dirty || saving} onClick={handleSave}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 space-y-4">
        <div>
          <div className="text-sm font-semibold text-slate-100">Status</div>
          <div className="mt-2">
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="unpublished">Unpublished</option>
            </Select>
          </div>
        </div>

        <div>
          <div className="text-sm font-semibold text-slate-100">SEO</div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <Input
              value={seo.title}
              onChange={(e) => setSeo((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="SEO title"
            />
            <Input
              value={seo.h1}
              onChange={(e) => setSeo((prev) => ({ ...prev, h1: e.target.value }))}
              placeholder="SEO H1"
            />
            <Input
              value={seo.description}
              onChange={(e) => setSeo((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="SEO description"
            />
            <Input
              value={seo.canonical}
              onChange={(e) => setSeo((prev) => ({ ...prev, canonical: e.target.value }))}
              placeholder="Canonical URL (optional)"
            />
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={seo.index}
              onChange={(e) => setSeo((prev) => ({ ...prev, index: e.target.checked }))}
              className="h-4 w-4 rounded border-slate-600"
            />
            <span>Index page in search engines</span>
          </div>
        </div>
      </div>

      {message && <div className="text-xs text-slate-300">{message}</div>}

      <div className="sticky bottom-0 z-40 -mx-4 border-t border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur sm:-mx-6 lg:-mx-8">
        <div className="flex items-center justify-between">
          <div className="text-xs text-slate-400">{dirty ? "Unsaved changes" : "All changes saved"}</div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => window.history.back()}>
              Cancel
            </Button>
            <Button variant="primary" disabled={!dirty || saving} onClick={handleSave}>
              {saving ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
