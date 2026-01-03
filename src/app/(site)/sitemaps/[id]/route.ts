import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { Timestamp } from "firebase-admin/firestore";
import { getSiteSettings } from "@/lib/settings";
import { resolveBaseUrl } from "@/lib/env";
import { canUseAdmin, getAdminDb } from "@/lib/firebase-admin";
import { getPublicDb } from "@/lib/firestore-public";
import { buildSitemapEntries } from "@/lib/sitemap-entries";
import { collection, getDocs, limit, orderBy, query, where } from "firebase/firestore";

function xmlEscape(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const settings = await getSiteSettings();
  const hdrs = await headers();
  const base = resolveBaseUrl(hdrs, settings.seo.canonicalMode === "siteUrl" ? settings.siteUrl : undefined);
  if (!settings.seo.allowIndexing || settings.seo.robotsPolicy === "noindex") {
    return new NextResponse("", { status: 200, headers: { "Content-Type": "application/xml" } });
  }

  const { id } = await params;
  const pageIndex = Number(id.replace(".xml", ""));
  if (!Number.isFinite(pageIndex) || pageIndex < 0) {
    return new NextResponse("", { status: 404 });
  }

  const chunkSize = Math.min(settings.performance.sitemapChunkSize || 5000, 50000);
  const offset = pageIndex * chunkSize;

  let pages: any[] = [];
  if (canUseAdmin()) {
    let ref = getAdminDb()
      .collection("pages")
      .where("status", "==", "published")
      .orderBy("__name__")
      .offset(offset)
      .limit(chunkSize);
    const snap = await ref.get();
    pages = snap.docs.map((d) => d.data() as any);
  } else {
    const db = getPublicDb();
    const q = query(
      collection(db, "pages"),
      where("status", "==", "published"),
      orderBy("__name__"),
      limit(chunkSize)
    );
    const snap = await getDocs(q);
    pages = snap.docs.map((d) => d.data() as any);
  }

  const entries = buildSitemapEntries(pages, base);
  const urls = entries.map((entry) => {
    const lastmod = entry.lastModified ? `<lastmod>${entry.lastModified.toISOString()}</lastmod>` : "";
    return `<url><loc>${xmlEscape(entry.url)}</loc>${lastmod}</url>`;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `${urls.join("\n")}\n` +
    `</urlset>`;

  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
