export type SiteConfig = {
  siteName: string;
  siteUrl: string;
  defaultMarket: string;
  seo: {
    allowIndexing: boolean;
    sitemapLimit: number;
    robotsPolicy: "index" | "noindex";
    canonicalMode: "siteUrl" | "requestHost";
    includeLegacyRoutes: boolean;
    includeEstimateGlobal: boolean;
    defaultOgImageUrl: string;
    twitterHandle?: string;
    titleTemplate: string;
    metaDescriptionTemplate: string;
    noindexUnpublished: boolean;
    noindexThinPages: boolean;
  };
  branding: {
    logoUrl: string;
    phone: string;
    supportEmail: string;
    primaryCtaLabel: string;
    address?: string;
    serviceAreaText?: string;
  };
  leads: {
    dedupEnabled: boolean;
    dedupWindowDays: number;
    requirePhone: boolean;
    requireEmail: boolean;
    minMessageLength: number;
    defaultStatus: "new" | "assigned" | "closed";
    notifyEmails: string[];
    notifyOnNewLead: boolean;
    leadRoutingMode: "manual" | "roundRobin" | "byService" | "byZip";
  };
  analytics: {
    gaMeasurementId?: string;
    gtmContainerId?: string;
    metaPixelId?: string;
    googleAdsConversionId?: string;
    googleAdsConversionLabel?: string;
  };
  legal: {
    privacyPolicyUrl: string;
    termsUrl: string;
    showConsentCheckbox: boolean;
    consentText: string;
  };
  performance: {
    crawlDelaySeconds: number;
    sitemapChunkSize: number;
    revalidateSeconds: number;
  };
};

export const DEFAULT_SITE_CONFIG: SiteConfig = {
  siteName: "LA County Pros",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "",
  defaultMarket: "la-county",
  seo: {
    allowIndexing: true,
    sitemapLimit: 5000,
    robotsPolicy: "index",
    canonicalMode: "siteUrl",
    includeLegacyRoutes: true,
    includeEstimateGlobal: true,
    defaultOgImageUrl: "",
    titleTemplate: "{service} in {place}, {zip} | {siteName}",
    metaDescriptionTemplate: "Get a fast estimate for {service} in {place}, {zip}.",
    noindexUnpublished: true,
    noindexThinPages: false,
  },
  branding: {
    logoUrl: "",
    phone: "",
    supportEmail: "",
    primaryCtaLabel: "Get instant estimate",
  },
  leads: {
    dedupEnabled: true,
    dedupWindowDays: 1,
    requirePhone: true,
    requireEmail: false,
    minMessageLength: 0,
    defaultStatus: "new",
    notifyEmails: [],
    notifyOnNewLead: false,
    leadRoutingMode: "manual",
  },
  analytics: {},
  legal: {
    privacyPolicyUrl: "",
    termsUrl: "",
    showConsentCheckbox: true,
    consentText: "I agree to be contacted about my estimate.",
  },
  performance: {
    crawlDelaySeconds: 0,
    sitemapChunkSize: 5000,
    revalidateSeconds: 0,
  },
};
