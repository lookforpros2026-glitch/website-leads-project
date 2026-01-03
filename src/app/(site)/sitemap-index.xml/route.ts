import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getSiteSettings } from "@/lib/settings";
import { resolveBaseUrl } from "@/lib/env";
import { canUseAdmin, getAdminDb } from "@/lib/firebase-admin";
import { getPublicDb } from "@/lib/firestore-public";
import { collection, getCountFromServer, query, where } from "firebase/firestore";

function xmlEscape(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function GET() {
  const settings = await getSiteSettings();
  const hdrs = await headers();
  const base = resolveBaseUrl(hdrs, settings.seo.canonicalMode === "siteUrl" ? settings.siteUrl : undefined);
  if (!settings.seo.allowIndexing || settings.seo.robotsPolicy === "noindex") {
    return new NextResponse("", { status: 200, headers: { "Content-Type": "application/xml" } });
  }

  const chunkSize = Math.min(settings.performance.sitemapChunkSize || 5000, 50000);
  let total = 0;
  try {
    if (canUseAdmin()) {
      const snap = await getAdminDb().collection("pages").where("status", "==", "published").count().get();
      total = snap.data().count || 0;
    } else {
      const db = getPublicDb();
      const q = query(collection(db, "pages"), where("status", "==", "published"));
      const snap = await getCountFromServer(q);
      total = snap.data().count || 0;
    }
  } catch {
    total = 0;
  }

  const pages = Math.max(1, Math.ceil(total / chunkSize));
  const items = [];
  for (let i = 0; i < pages; i += 1) {
    items.push(`<sitemap><loc>${xmlEscape(`${base}/sitemaps/${i}`)}</loc></sitemap>`);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `${items.join("\n")}\n` +
    `</sitemapindex>`;

  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
