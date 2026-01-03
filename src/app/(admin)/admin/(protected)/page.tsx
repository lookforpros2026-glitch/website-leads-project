import Link from "next/link";
import { getAdminDb } from "@/lib/firebase-admin";
import { CardShell } from "@/components/admin/ui";
import PageHealthCard from "@/components/admin/PageHealthCard";

async function getCounts() {
  const db = getAdminDb();
  const pages = await db.collection("pages").count().get();
  const published = await db.collection("pages").where("status", "==", "published").count().get();
  const draft = await db.collection("pages").where("status", "in", ["draft", "review"]).count().get();
  return {
    pages: pages.data().count,
    published: published.data().count,
    draft: draft.data().count,
  };
}

export default async function AdminHome() {
  const { pages, published, draft } = await getCounts();
  const qaPassRate = published + draft > 0 ? Math.round((published / (published + draft)) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Admin Studio</h1>
          <p className="text-sm text-neutral-600">Control center for programmatic SEO pages</p>
        </div>
        <Link
          href="/admin/pages/generate"
          className="h-10 px-4 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800"
        >
          Generate pages
        </Link>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <CardShell className="p-4">
          <div className="text-xs text-neutral-500">Total Pages</div>
          <div className="text-2xl font-semibold text-neutral-900">{pages}</div>
        </CardShell>
        <CardShell className="p-4">
          <div className="text-xs text-neutral-500">Published</div>
          <div className="text-2xl font-semibold text-neutral-900">{published}</div>
          <div className="text-xs text-neutral-500">Draft/Review: {draft}</div>
        </CardShell>
        <CardShell className="p-4">
          <div className="text-xs text-neutral-500">QA pass rate</div>
          <div className="text-2xl font-semibold text-neutral-900">{qaPassRate}%</div>
        </CardShell>
      </div>

      <CardShell className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-neutral-900">Quick actions</div>
            <div className="text-xs text-neutral-500">Generate and manage pages</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link href="/admin/pages/generate" className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 hover:border-blue-200">
            Generate
          </Link>
          <Link href="/admin/pages?status=draft" className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 hover:border-blue-200">
            Draft
          </Link>
          <Link href="/admin/pages?status=published" className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 hover:border-blue-200">
            Published
          </Link>
          <Link href="/admin/pages/gallery" className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 hover:border-blue-200">
            Open Gallery
          </Link>
          <Link href="/admin/pages" className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 hover:border-blue-200">
            Table view
          </Link>
        </div>
      </CardShell>

      <PageHealthCard />
    </div>
  );
}
