import { headers } from "next/headers";
import { canUseAdmin, getAdminDb } from "@/lib/firebase-admin";
import { getSiteSettings } from "@/lib/settings";
import { resolveBaseUrl } from "@/lib/env";
import { getPublicDb } from "@/lib/firestore-public";
import { buildCanonicalPath } from "@/lib/page-paths";
import { collection, getDocs, limit, query, where } from "firebase/firestore";

export default async function sitemap() {
  const settings = await getSiteSettings();
  const hdrs = await headers();
  const base = resolveBaseUrl(hdrs, settings.seo.canonicalMode === "siteUrl" ? settings.siteUrl : undefined);
  if (!settings.seo.allowIndexing || settings.seo.robotsPolicy === "noindex") {
    return [{ url: base, lastModified: new Date() }];
  }
  const limitCount = Math.min(settings.seo.sitemapLimit || 5000, settings.performance.sitemapChunkSize || 5000);
  const includeEstimate = settings.seo.includeEstimateGlobal;
  const includeLegacy = settings.seo.includeLegacyRoutes;
  try {
    if (canUseAdmin()) {
      const snap = await getAdminDb()
        .collection("pages")
        .where("status", "==", "published")
        .limit(limitCount)
        .get();
      const entries = snap.docs
        .map((d) => {
          const data = d.data() as any;
          const updated = data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date();
          const path = buildCanonicalPath(data);
          return { url: `${base}${path}`, lastModified: updated };
        })
        .filter((entry) => {
          if (includeLegacy) return true;
          return !entry.url.includes("/la-county/");
        });
      return [
        { url: base, lastModified: new Date() },
        ...(includeEstimate ? [{ url: `${base}/estimate`, lastModified: new Date() }] : []),
        ...entries,
      ];
    }
    const db = getPublicDb();
    const q = query(
      collection(db, "pages"),
      where("status", "==", "published"),
      limit(limitCount)
    );
    const snap = await getDocs(q);
    const entries = snap.docs
      .map((d) => {
        const data = d.data() as any;
        const updated = (data as any).updatedAt?.toDate ? (data as any).updatedAt.toDate() : new Date();
        const path = buildCanonicalPath(data as any);
        return { url: `${base}${path}`, lastModified: updated };
      })
      .filter((entry) => {
        if (includeLegacy) return true;
        return !entry.url.includes("/la-county/");
      });
    return [
      { url: base, lastModified: new Date() },
      ...(includeEstimate ? [{ url: `${base}/estimate`, lastModified: new Date() }] : []),
      ...entries,
    ];
  } catch {
    return [
      { url: base, lastModified: new Date() },
      ...(includeEstimate ? [{ url: `${base}/estimate`, lastModified: new Date() }] : []),
    ];
  }
}
