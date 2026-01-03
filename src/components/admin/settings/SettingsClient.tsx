"use client";

import { useMemo, useState } from "react";
import { AdminPanel } from "@/components/admin/ui/AdminPanel";
import { Button } from "@/components/ui/Button";
import type { SiteConfig } from "@/lib/settings-types";
import { DEFAULT_SITE_CONFIG } from "@/lib/settings-types";

type Props = { initial: SiteConfig };

function inputClass(extra?: string) {
  return [
    "h-10 w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 text-sm text-slate-100",
    "placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-700",
    extra || "",
  ].join(" ");
}

function labelClass() {
  return "text-xs font-semibold uppercase text-slate-400";
}

function sectionSummaryClass() {
  return "cursor-pointer list-none rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm font-semibold text-slate-100";
}

function sectionBodyClass() {
  return "mt-4 rounded-2xl border border-slate-800 bg-slate-900/30 p-4 space-y-4";
}

export default function SettingsClient({ initial }: Props) {
  const [config, setConfig] = useState<SiteConfig>(initial);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const notifyEmailsText = useMemo(
    () => (config.leads.notifyEmails || []).join(", "),
    [config.leads.notifyEmails]
  );

  function update<K extends keyof SiteConfig>(key: K, value: SiteConfig[K]) {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }

  function updateNested<T extends keyof SiteConfig, K extends keyof SiteConfig[T]>(
    section: T,
    key: K,
    value: SiteConfig[T][K],
  ) {
    setConfig((prev) => ({
      ...prev,
      [section]: {
        ...(prev[section] as any),
        [key]: value,
      },
    }));
  }

  async function save() {
    setSaving(true);
    setStatus(null);
    setError(null);
    try {
      const payload: SiteConfig = {
        ...config,
        leads: {
          ...config.leads,
          notifyEmails: notifyEmailsText
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        },
      };
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "Failed to save settings");
      }
      setStatus("Saved");
      setTimeout(() => setStatus(null), 2000);
    } catch (e: any) {
      setError(e?.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <AdminPanel
        title="Settings"
        subtitle="SEO, branding, leads, analytics, legal, and performance."
        actions={
          <div className="flex items-center gap-3">
            {status && <span className="text-xs text-emerald-300">{status}</span>}
            {error && <span className="text-xs text-rose-300">{error}</span>}
            <Button variant="primary" onClick={save} disabled={saving}>
              {saving ? "Saving..." : "Save settings"}
            </Button>
          </div>
        }
      />

      <details open>
        <summary className={sectionSummaryClass()}>SEO & Indexing</summary>
        <div className={sectionBodyClass()}>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className={labelClass()}>Site name</label>
              <input
                className={inputClass()}
                value={config.siteName}
                onChange={(e) => update("siteName", e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass()}>Site URL</label>
              <input
                className={inputClass()}
                value={config.siteUrl}
                onChange={(e) => update("siteUrl", e.target.value)}
                placeholder="https://example.com"
              />
            </div>
            <div>
              <label className={labelClass()}>Default market</label>
              <input
                className={inputClass()}
                value={config.defaultMarket}
                onChange={(e) => update("defaultMarket", e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass()}>Sitemap limit</label>
              <input
                className={inputClass()}
                type="number"
                min={1}
                value={config.seo.sitemapLimit}
                onChange={(e) => updateNested("seo", "sitemapLimit", Number(e.target.value || 0))}
              />
            </div>
            <div>
              <label className={labelClass()}>Robots policy</label>
              <select
                className={inputClass()}
                value={config.seo.robotsPolicy}
                onChange={(e) => updateNested("seo", "robotsPolicy", e.target.value as any)}
              >
                <option value="index">Index</option>
                <option value="noindex">Noindex</option>
              </select>
            </div>
            <div>
              <label className={labelClass()}>Canonical mode</label>
              <select
                className={inputClass()}
                value={config.seo.canonicalMode}
                onChange={(e) => updateNested("seo", "canonicalMode", e.target.value as any)}
              >
                <option value="siteUrl">Site URL</option>
                <option value="requestHost">Request host</option>
              </select>
            </div>
            <div>
              <label className={labelClass()}>Title template</label>
              <input
                className={inputClass()}
                value={config.seo.titleTemplate}
                onChange={(e) => updateNested("seo", "titleTemplate", e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass()}>Meta description template</label>
              <input
                className={inputClass()}
                value={config.seo.metaDescriptionTemplate}
                onChange={(e) => updateNested("seo", "metaDescriptionTemplate", e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass()}>Default OG image URL</label>
              <input
                className={inputClass()}
                value={config.seo.defaultOgImageUrl}
                onChange={(e) => updateNested("seo", "defaultOgImageUrl", e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass()}>Twitter handle</label>
              <input
                className={inputClass()}
                value={config.seo.twitterHandle || ""}
                onChange={(e) => updateNested("seo", "twitterHandle", e.target.value)}
                placeholder="@brand"
              />
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex items-center gap-3 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={config.seo.allowIndexing}
                onChange={(e) => updateNested("seo", "allowIndexing", e.target.checked)}
              />
              Allow indexing
            </label>
            <label className="flex items-center gap-3 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={config.seo.noindexUnpublished}
                onChange={(e) => updateNested("seo", "noindexUnpublished", e.target.checked)}
              />
              Noindex unpublished pages
            </label>
            <label className="flex items-center gap-3 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={config.seo.includeLegacyRoutes}
                onChange={(e) => updateNested("seo", "includeLegacyRoutes", e.target.checked)}
              />
              Include legacy routes in sitemap
            </label>
            <label className="flex items-center gap-3 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={config.seo.includeEstimateGlobal}
                onChange={(e) => updateNested("seo", "includeEstimateGlobal", e.target.checked)}
              />
              Include /estimate in sitemap
            </label>
          </div>
        </div>
      </details>

      <details>
        <summary className={sectionSummaryClass()}>Branding</summary>
        <div className={sectionBodyClass()}>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className={labelClass()}>Logo URL</label>
              <input
                className={inputClass()}
                value={config.branding.logoUrl}
                onChange={(e) => updateNested("branding", "logoUrl", e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass()}>Primary CTA label</label>
              <input
                className={inputClass()}
                value={config.branding.primaryCtaLabel}
                onChange={(e) => updateNested("branding", "primaryCtaLabel", e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass()}>Phone</label>
              <input
                className={inputClass()}
                value={config.branding.phone}
                onChange={(e) => updateNested("branding", "phone", e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass()}>Support email</label>
              <input
                className={inputClass()}
                value={config.branding.supportEmail}
                onChange={(e) => updateNested("branding", "supportEmail", e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass()}>Address</label>
              <input
                className={inputClass()}
                value={config.branding.address || ""}
                onChange={(e) => updateNested("branding", "address", e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass()}>Service area text</label>
              <input
                className={inputClass()}
                value={config.branding.serviceAreaText || ""}
                onChange={(e) => updateNested("branding", "serviceAreaText", e.target.value)}
              />
            </div>
          </div>
        </div>
      </details>

      <details>
        <summary className={sectionSummaryClass()}>Leads</summary>
        <div className={sectionBodyClass()}>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className={labelClass()}>Dedup window (days)</label>
              <input
                className={inputClass()}
                type="number"
                min={1}
                max={30}
                value={config.leads.dedupWindowDays}
                onChange={(e) => updateNested("leads", "dedupWindowDays", Number(e.target.value || 1))}
              />
            </div>
            <div>
              <label className={labelClass()}>Minimum message length</label>
              <input
                className={inputClass()}
                type="number"
                min={0}
                max={2000}
                value={config.leads.minMessageLength}
                onChange={(e) => updateNested("leads", "minMessageLength", Number(e.target.value || 0))}
              />
            </div>
            <div>
              <label className={labelClass()}>Default status</label>
              <select
                className={inputClass()}
                value={config.leads.defaultStatus}
                onChange={(e) => updateNested("leads", "defaultStatus", e.target.value as any)}
              >
                <option value="new">New</option>
                <option value="assigned">Assigned</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            <div>
              <label className={labelClass()}>Routing mode</label>
              <select
                className={inputClass()}
                value={config.leads.leadRoutingMode}
                onChange={(e) => updateNested("leads", "leadRoutingMode", e.target.value as any)}
              >
                <option value="manual">Manual</option>
                <option value="roundRobin">Round robin</option>
                <option value="byService">By service</option>
                <option value="byZip">By ZIP</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className={labelClass()}>Notification emails</label>
              <input
                className={inputClass()}
                value={notifyEmailsText}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    leads: { ...prev.leads, notifyEmails: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) },
                  }))
                }
                placeholder="you@example.com, ops@example.com"
              />
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex items-center gap-3 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={config.leads.dedupEnabled}
                onChange={(e) => updateNested("leads", "dedupEnabled", e.target.checked)}
              />
              Dedup enabled
            </label>
            <label className="flex items-center gap-3 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={config.leads.requirePhone}
                onChange={(e) => updateNested("leads", "requirePhone", e.target.checked)}
              />
              Require phone
            </label>
            <label className="flex items-center gap-3 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={config.leads.requireEmail}
                onChange={(e) => updateNested("leads", "requireEmail", e.target.checked)}
              />
              Require email
            </label>
            <label className="flex items-center gap-3 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={config.leads.notifyOnNewLead}
                onChange={(e) => updateNested("leads", "notifyOnNewLead", e.target.checked)}
              />
              Notify on new lead
            </label>
          </div>
        </div>
      </details>

      <details>
        <summary className={sectionSummaryClass()}>Analytics</summary>
        <div className={sectionBodyClass()}>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className={labelClass()}>GA Measurement ID</label>
              <input
                className={inputClass()}
                value={config.analytics.gaMeasurementId || ""}
                onChange={(e) => updateNested("analytics", "gaMeasurementId", e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass()}>GTM Container ID</label>
              <input
                className={inputClass()}
                value={config.analytics.gtmContainerId || ""}
                onChange={(e) => updateNested("analytics", "gtmContainerId", e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass()}>Meta Pixel ID</label>
              <input
                className={inputClass()}
                value={config.analytics.metaPixelId || ""}
                onChange={(e) => updateNested("analytics", "metaPixelId", e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass()}>Google Ads conversion ID</label>
              <input
                className={inputClass()}
                value={config.analytics.googleAdsConversionId || ""}
                onChange={(e) => updateNested("analytics", "googleAdsConversionId", e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass()}>Google Ads conversion label</label>
              <input
                className={inputClass()}
                value={config.analytics.googleAdsConversionLabel || ""}
                onChange={(e) => updateNested("analytics", "googleAdsConversionLabel", e.target.value)}
              />
            </div>
          </div>
        </div>
      </details>

      <details>
        <summary className={sectionSummaryClass()}>Legal & Consent</summary>
        <div className={sectionBodyClass()}>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className={labelClass()}>Privacy policy URL</label>
              <input
                className={inputClass()}
                value={config.legal.privacyPolicyUrl}
                onChange={(e) => updateNested("legal", "privacyPolicyUrl", e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass()}>Terms URL</label>
              <input
                className={inputClass()}
                value={config.legal.termsUrl}
                onChange={(e) => updateNested("legal", "termsUrl", e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-3">
            <label className="flex items-center gap-3 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={config.legal.showConsentCheckbox}
                onChange={(e) => updateNested("legal", "showConsentCheckbox", e.target.checked)}
              />
              Show consent checkbox
            </label>
            <div>
              <label className={labelClass()}>Consent text</label>
              <textarea
                className={inputClass("h-24 py-2")}
                value={config.legal.consentText}
                onChange={(e) => updateNested("legal", "consentText", e.target.value)}
              />
            </div>
          </div>
        </div>
      </details>

      <details>
        <summary className={sectionSummaryClass()}>Performance</summary>
        <div className={sectionBodyClass()}>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className={labelClass()}>Crawl delay (seconds)</label>
              <input
                className={inputClass()}
                type="number"
                min={0}
                max={120}
                value={config.performance.crawlDelaySeconds}
                onChange={(e) => updateNested("performance", "crawlDelaySeconds", Number(e.target.value || 0))}
              />
            </div>
            <div>
              <label className={labelClass()}>Sitemap chunk size</label>
              <input
                className={inputClass()}
                type="number"
                min={100}
                max={50000}
                value={config.performance.sitemapChunkSize}
                onChange={(e) => updateNested("performance", "sitemapChunkSize", Number(e.target.value || 0))}
              />
            </div>
            <div>
              <label className={labelClass()}>Public page revalidate (seconds)</label>
              <input
                className={inputClass()}
                type="number"
                min={0}
                max={86400}
                value={config.performance.revalidateSeconds}
                onChange={(e) => updateNested("performance", "revalidateSeconds", Number(e.target.value || 0))}
              />
            </div>
          </div>
        </div>
      </details>

      <details>
        <summary className={sectionSummaryClass()}>Advanced</summary>
        <div className={sectionBodyClass()}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-100">Reset to defaults</div>
              <div className="text-xs text-slate-500">Overwrites the current draft settings with defaults.</div>
            </div>
            <Button
              variant="secondary"
              onClick={() => setConfig(DEFAULT_SITE_CONFIG)}
            >
              Reset to defaults
            </Button>
          </div>
        </div>
      </details>
    </div>
  );
}
