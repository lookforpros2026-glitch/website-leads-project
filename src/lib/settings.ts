import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "./firebase-admin";
import { DEFAULT_SITE_CONFIG } from "./settings-types";
import type { SiteConfig } from "./settings-types";


function mergeConfig(partial: Partial<SiteConfig> | null | undefined): SiteConfig {
  if (!partial) return DEFAULT_SITE_CONFIG;
  return {
    ...DEFAULT_SITE_CONFIG,
    ...partial,
    seo: { ...DEFAULT_SITE_CONFIG.seo, ...(partial as any).seo },
    branding: { ...DEFAULT_SITE_CONFIG.branding, ...(partial as any).branding },
    leads: { ...DEFAULT_SITE_CONFIG.leads, ...(partial as any).leads },
    analytics: { ...DEFAULT_SITE_CONFIG.analytics, ...(partial as any).analytics },
    legal: { ...DEFAULT_SITE_CONFIG.legal, ...(partial as any).legal },
    performance: { ...DEFAULT_SITE_CONFIG.performance, ...(partial as any).performance },
  };
}

function mapLegacySettings(legacy: any): Partial<SiteConfig> {
  if (!legacy || typeof legacy !== "object") return {};
  return {
    siteName: legacy.siteName,
    siteUrl: legacy.siteUrl,
    defaultMarket: legacy.defaultMarket,
    seo: {
      allowIndexing: legacy.enableIndexing ?? DEFAULT_SITE_CONFIG.seo.allowIndexing,
      sitemapLimit: legacy.sitemapLimit ?? DEFAULT_SITE_CONFIG.seo.sitemapLimit,
    } as any,
  };
}

export async function getSiteSettings(): Promise<SiteConfig> {
  try {
    const db = getAdminDb();
    const snap = await db.collection("config").doc("site").get();
    if (snap.exists) {
      const data = snap.data() as Partial<SiteConfig> & { updatedAt?: unknown };
      const { updatedAt: _updatedAt, ...rest } = data;
      return mergeConfig(rest);
    }

    const legacy = await db.collection("site_settings").doc("default").get();
    if (legacy.exists) {
      return mergeConfig(mapLegacySettings(legacy.data()));
    }
    return DEFAULT_SITE_CONFIG;
  } catch {
    return DEFAULT_SITE_CONFIG;
  }
}

export async function saveSiteSettings(values: SiteConfig) {
  const { requireAdmin } = await import("./auth.app.server");
  await requireAdmin();
  const db = getAdminDb();
  await db
    .collection("config")
    .doc("site")
    .set(
      {
        ...values,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
}

export type { SiteConfig };
export { DEFAULT_SITE_CONFIG };
