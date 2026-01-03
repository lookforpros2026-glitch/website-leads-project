import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/authz";
import { getSiteSettings, saveSiteSettings } from "@/lib/settings";
import type { SiteConfig } from "@/lib/settings";
import { DEFAULT_SITE_CONFIG } from "@/lib/settings-types";

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function parseEmailList(raw: string | undefined) {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeConfig(input: any): SiteConfig | null {
  if (!input || typeof input !== "object") return null;
  const siteUrl = typeof input.siteUrl === "string" ? input.siteUrl.trim() : "";
  if (siteUrl) {
    try {
      const u = new URL(siteUrl);
      if (!u.hostname) return null;
    } catch {
      return null;
    }
  }
  const allowIndexing = Boolean(input.seo?.allowIndexing);
  const robotsPolicy = input.seo?.robotsPolicy === "noindex" ? "noindex" : "index";
  const canonicalMode = input.seo?.canonicalMode === "requestHost" ? "requestHost" : "siteUrl";
  const includeLegacyRoutes = input.seo?.includeLegacyRoutes !== false;
  const includeEstimateGlobal = input.seo?.includeEstimateGlobal !== false;
  const noindexUnpublished = input.seo?.noindexUnpublished !== false;
  const noindexThinPages = Boolean(input.seo?.noindexThinPages);

  const dedupWindowDays = clampNumber(Number(input.leads?.dedupWindowDays ?? 1), 1, 30);
  const minMessageLength = clampNumber(Number(input.leads?.minMessageLength ?? 0), 0, 2000);
  const crawlDelaySeconds = clampNumber(Number(input.performance?.crawlDelaySeconds ?? 0), 0, 120);
  const sitemapLimit = clampNumber(Number(input.seo?.sitemapLimit ?? 5000), 1, 50000);
  const sitemapChunkSize = clampNumber(Number(input.performance?.sitemapChunkSize ?? 5000), 100, 50000);
  const revalidateSeconds = clampNumber(Number(input.performance?.revalidateSeconds ?? 0), 0, 86400);

  return {
    siteName: String(input.siteName || DEFAULT_SITE_CONFIG.siteName),
    siteUrl,
    defaultMarket: String(input.defaultMarket || DEFAULT_SITE_CONFIG.defaultMarket),
    seo: {
      allowIndexing,
      sitemapLimit,
      robotsPolicy,
      canonicalMode,
      includeLegacyRoutes,
      includeEstimateGlobal,
      defaultOgImageUrl: String(input.seo?.defaultOgImageUrl || ""),
      twitterHandle: input.seo?.twitterHandle ? String(input.seo.twitterHandle) : undefined,
      titleTemplate: String(input.seo?.titleTemplate || DEFAULT_SITE_CONFIG.seo.titleTemplate),
      metaDescriptionTemplate: String(input.seo?.metaDescriptionTemplate || DEFAULT_SITE_CONFIG.seo.metaDescriptionTemplate),
      noindexUnpublished,
      noindexThinPages,
    },
    branding: {
      logoUrl: String(input.branding?.logoUrl || ""),
      phone: String(input.branding?.phone || ""),
      supportEmail: String(input.branding?.supportEmail || ""),
      primaryCtaLabel: String(input.branding?.primaryCtaLabel || DEFAULT_SITE_CONFIG.branding.primaryCtaLabel),
      address: input.branding?.address ? String(input.branding.address) : undefined,
      serviceAreaText: input.branding?.serviceAreaText ? String(input.branding.serviceAreaText) : undefined,
    },
    leads: {
      dedupEnabled: input.leads?.dedupEnabled !== false,
      dedupWindowDays,
      requirePhone: input.leads?.requirePhone !== false,
      requireEmail: Boolean(input.leads?.requireEmail),
      minMessageLength,
      defaultStatus: (input.leads?.defaultStatus as SiteConfig["leads"]["defaultStatus"]) || "new",
      notifyEmails: Array.isArray(input.leads?.notifyEmails)
        ? input.leads.notifyEmails.map((v: any) => String(v)).filter(Boolean)
        : parseEmailList(input.leads?.notifyEmails),
      notifyOnNewLead: Boolean(input.leads?.notifyOnNewLead),
      leadRoutingMode: (input.leads?.leadRoutingMode as SiteConfig["leads"]["leadRoutingMode"]) || "manual",
    },
    analytics: {
      gaMeasurementId: input.analytics?.gaMeasurementId ? String(input.analytics.gaMeasurementId) : undefined,
      gtmContainerId: input.analytics?.gtmContainerId ? String(input.analytics.gtmContainerId) : undefined,
      metaPixelId: input.analytics?.metaPixelId ? String(input.analytics.metaPixelId) : undefined,
      googleAdsConversionId: input.analytics?.googleAdsConversionId ? String(input.analytics.googleAdsConversionId) : undefined,
      googleAdsConversionLabel: input.analytics?.googleAdsConversionLabel ? String(input.analytics.googleAdsConversionLabel) : undefined,
    },
    legal: {
      privacyPolicyUrl: String(input.legal?.privacyPolicyUrl || ""),
      termsUrl: String(input.legal?.termsUrl || ""),
      showConsentCheckbox: input.legal?.showConsentCheckbox !== false,
      consentText: String(input.legal?.consentText || DEFAULT_SITE_CONFIG.legal.consentText),
    },
    performance: {
      crawlDelaySeconds,
      sitemapChunkSize,
      revalidateSeconds,
    },
  };
}

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }
  const config = await getSiteSettings();
  return NextResponse.json({ ok: true, config });
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }
  const body = await req.json().catch(() => null);
  const normalized = normalizeConfig(body);
  if (!normalized) {
    return NextResponse.json({ ok: false, error: "INVALID_CONFIG" }, { status: 400 });
  }
  await saveSiteSettings(normalized);
  return NextResponse.json({ ok: true });
}
