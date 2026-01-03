"use client";

import useSWR from "swr";
import {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";
import {
  Search,
  Settings,
  Plus,
  Upload,
  X,
  RefreshCcw,
  Trash2,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { jsonFetcher } from "@/lib/fetcher";
import { slugify } from "@/lib/slug";
import { useBreakpoint } from "@/lib/useBreakpoint";
import GeneratorShell from "@/components/admin/pages/generator/GeneratorShell";
import StickyGenerateBar from "@/components/admin/pages/generator/StickyGenerateBar";
import SelectorCard from "@/components/admin/pages/generator/SelectorCard";
import MobileSelectorSheet from "@/components/admin/pages/generator/MobileSelectorSheet";
import AdvancedGeoTools from "@/components/admin/pages/generator/AdvancedGeoTools";
import GeneratorStatusPanel from "@/components/admin/pages/generator/GeneratorStatusPanel";

type County = { id: string; name: string; countySlug: string; stateId: string };
type Zip = { id: string; zip: string; countySlug: string; primaryPlaceName?: string; placeNames?: string[] };
type ZipPlace = {
  id: string;
  placeName: string;
  slug: string;
  zip: string;
  countySlug: string;
  countyName?: string | null;
  displayName?: string | null;
};

type ServiceItem = {
  id: string;
  key?: string;
  slug?: string;
  name: string;
  category?: string | null;
  enabled?: boolean;
  inEstimator?: boolean;
  inGenerator?: boolean;
  sort?: number | null;
  description?: string | null;
  estimator?: {
    enabled?: boolean;
    baseMin?: number;
    baseMax?: number;
    unit?: string | null;
    defaultDurationDays?: { min?: number; max?: number };
  };
};

type JobStatus = {
  status: string;
  total: number;
  completed: number;
  etaSeconds: number | null;
  elapsedSeconds: number | null;
  currentOperation?: string | null;
  errorMessage?: string | null;
  canceled?: boolean;
};

const AVG_SECONDS_PER_PAGE = 0.4;

export function GeneratorClient() {
  const { isMobile } = useBreakpoint();
  const { data: health, mutate: refreshHealth } = useSWR<{
    ok: boolean;
    countyCount: number;
    cityCount: number;
    allowImport: boolean;
    locked: boolean;
  }>("/api/admin/geo/health", jsonFetcher);

  const { data: countyResp } = useSWR<{ ok: boolean; counties: County[] }>("/api/admin/geo/counties", jsonFetcher);
  const counties = countyResp?.counties || [];

  const [zipsByCounty, setZipsByCounty] = useState<Record<string, Zip[]>>({});
  const [zipLoadingByCounty, setZipLoadingByCounty] = useState<Record<string, boolean>>({});

  const [selectedCountySlugs, setSelectedCountySlugs] = useState<Set<string>>(new Set());
  const [selectedZipPlaceIds, setSelectedZipPlaceIds] = useState<Set<string>>(new Set());

  const zipById = useMemo(() => {
    const map: Record<string, Zip> = {};
    Object.values(zipsByCounty).forEach((list) => {
      list.forEach((zip) => {
        map[zip.id] = zip;
      });
    });
    return map;
  }, [zipsByCounty]);

  const [services, setServices] = useState<ServiceItem[]>([]);
  const [serviceLoading, setServiceLoading] = useState(false);
  const [serviceSearch, setServiceSearch] = useState("");
  const [serviceTab, setServiceTab] = useState<"all" | "groups" | "pricing">("all");
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());
  const [newServiceOpen, setNewServiceOpen] = useState(false);
  const [newServiceName, setNewServiceName] = useState("");
  const [newServiceKey, setNewServiceKey] = useState("");
  const [newServiceCategory, setNewServiceCategory] = useState("");
  const [newServiceDescription, setNewServiceDescription] = useState("");
  const [newServiceMin, setNewServiceMin] = useState("");
  const [newServiceMax, setNewServiceMax] = useState("");
  const [newServiceUnit, setNewServiceUnit] = useState("");
  const [newServiceEnabled, setNewServiceEnabled] = useState(true);
  const [newServiceInEstimator, setNewServiceInEstimator] = useState(true);
  const [newServiceInGenerator, setNewServiceInGenerator] = useState(true);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [editingServiceName, setEditingServiceName] = useState("");
  const [editingServiceCategory, setEditingServiceCategory] = useState("");
  const [editingServiceMin, setEditingServiceMin] = useState("");
  const [editingServiceMax, setEditingServiceMax] = useState("");
  const [editingServiceUnit, setEditingServiceUnit] = useState("");
  const [editingServiceEnabled, setEditingServiceEnabled] = useState(true);
  const [editingServiceInEstimator, setEditingServiceInEstimator] = useState(true);
  const [editingServiceInGenerator, setEditingServiceInGenerator] = useState(true);
  const [quickAddName, setQuickAddName] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<ZipPlace[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchMessage, setSearchMessage] = useState("");
  const [zipServiceCoverage, setZipServiceCoverage] = useState<Record<string, number>>({});
  const [coverageLoading, setCoverageLoading] = useState(false);
  const [selectingAllLocations, setSelectingAllLocations] = useState(false);
  const [selectAllProgress, setSelectAllProgress] = useState<{ running: boolean; done: number; total: number } | null>(null);

  const [jobId, setJobId] = useState<string | null>(null);
  const { data: jobStatus } = useSWR<JobStatus>(
    jobId ? `/api/admin/pages/generate/status?jobId=${jobId}` : null,
    jsonFetcher,
    {
      refreshInterval: (latest) =>
        jobId && (!latest || latest.status === "running") ? 1000 : 0,
    }
  );
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [geoActionJson, setGeoActionJson] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [lockMessage, setLockMessage] = useState<string | null>(null);
  const [seedMessage, setSeedMessage] = useState<string | null>(null);
  const [purgeConfirm, setPurgeConfirm] = useState("");
  const [purgeMessage, setPurgeMessage] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [maxPages, setMaxPages] = useState("500");
  const [publishOnCreate, setPublishOnCreate] = useState(false);
  const [importCountySlug, setImportCountySlug] = useState("los-angeles");

  const [csvOpen, setCsvOpen] = useState(false);
  const [csvCountySlug, setCsvCountySlug] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvUploadStatus, setCsvUploadStatus] = useState<string | null>(null);
  const [csvUploadJson, setCsvUploadJson] = useState<string | null>(null);
  const [csvUploading, setCsvUploading] = useState(false);
  const [csvDragActive, setCsvDragActive] = useState(false);
  const [locationsOpen, setLocationsOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [mobileServiceVisible, setMobileServiceVisible] = useState(50);
  const [mobileCountyZipVisible, setMobileCountyZipVisible] = useState<Record<string, number>>({});
  const [serviceVisible, setServiceVisible] = useState(200);
  const totalPages =
    selectedZipPlaceIds.size > 0 && selectedServices.size > 0
      ? selectedZipPlaceIds.size * selectedServices.size
      : 0;
  const estimatedSeconds =
    totalPages > 0 ? Math.ceil(totalPages * AVG_SECONDS_PER_PAGE) : 0;

  const deriveSelectedCountySlugs = useCallback(
    (placeIds: Set<string>) => {
      const next = new Set<string>();
      placeIds.forEach((id) => {
        const zip = zipById[id];
        if (zip?.countySlug) next.add(zip.countySlug);
      });
      return next;
    },
    [zipById]
  );

  const applyPlaceSelection = useCallback(
    (placeIds: Set<string>) => {
      const next = new Set(placeIds);
      setSelectedZipPlaceIds(next);
      setSelectedCountySlugs(deriveSelectedCountySlugs(next));
    },
    [deriveSelectedCountySlugs]
  );
  const clearSelection = useCallback(() => {
    applyPlaceSelection(new Set());
    setSelectedServices(new Set());
  }, [applyPlaceSelection]);

  function SelectionButton({
    selected,
    onClick,
    label,
    disabled = false,
  }: {
    selected: boolean;
    onClick: () => void;
    label: string;
    disabled?: boolean;
  }) {
    const Icon = selected ? CheckCircle2 : Circle;
    return (
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        disabled={disabled}
        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-slate-950 text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Icon className={`h-5 w-5 ${selected ? "text-emerald-300" : "text-slate-500"}`} />
      </button>
    );
  }

  const formatSeconds = useCallback((value: number | null | undefined) => {
    if (value == null || Number.isNaN(value)) return "--";
    const total = Math.max(0, Math.floor(value));
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }, []);

  const selectedCountyCount = selectedCountySlugs.size;
  const visibleZipIds = useMemo(() => {
    const slugs = counties.map((c) => c.countySlug).filter(Boolean);
    const ids: string[] = [];
    slugs.forEach((slug) => {
      const list = zipsByCounty[slug] || [];
      const visibleCount = mobileCountyZipVisible[slug] ?? (isMobile ? 50 : 200);
      list.slice(0, visibleCount).forEach((zip) => {
        if (zip.id) ids.push(zip.id);
      });
    });
    return ids;
  }, [counties, isMobile, mobileCountyZipVisible, zipsByCounty]);

  const filteredServices = useMemo(() => {
    const list = Array.isArray(services) ? services : [];
    const q = serviceSearch.trim().toLowerCase();
    return list.filter((svc) => {
      if (svc.enabled === false) return false;
      if (svc.inGenerator === false) return false;
      if (!q) return true;
      const hay = `${svc.name} ${svc.key || ""} ${svc.category || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [services, serviceSearch]);

  const selectAllServices = useCallback(() => {
    const all = new Set<string>();
    filteredServices.forEach((svc) => {
      const key = svc.slug || svc.key || svc.id;
      if (key) all.add(key);
    });
    setSelectedServices(all);
  }, [filteredServices]);

  const visibleServices = filteredServices.slice(0, isMobile ? mobileServiceVisible : serviceVisible);

  const progressPct =
    jobStatus?.total && jobStatus.total > 0 ? Math.min(100, Math.round((jobStatus.completed / jobStatus.total) * 100)) : 0;
  const elapsedDisplay = formatSeconds(jobStatus?.elapsedSeconds ?? null);
  const etaDisplay = formatSeconds(jobStatus?.etaSeconds ?? null);

  const generateDisabled =
    jobStatus?.status === "running" || selectedZipPlaceIds.size === 0 || selectedServices.size === 0;
  const selectionHelper =
    generateError ||
    (jobStatus?.status === "running"
      ? "Generation in progress."
      : selectedZipPlaceIds.size === 0 || selectedServices.size === 0
      ? "Select at least 1 location and 1 service."
      : null);

  const fetchZips = useCallback(
    async (countySlug: string): Promise<Zip[]> => {
      if (!countySlug) return [];
      setZipLoadingByCounty((prev) => ({ ...prev, [countySlug]: true }));
      try {
        const res = await fetch(`/api/admin/geo/zips?countySlug=${encodeURIComponent(countySlug)}&limit=5000`);
        const json = await res.json().catch(() => ({}));
        const items = Array.isArray(json.items) ? json.items : Array.isArray(json.zips) ? json.zips : [];
        setZipsByCounty((prev) => ({ ...prev, [countySlug]: items }));
        return items;
      } finally {
        setZipLoadingByCounty((prev) => ({ ...prev, [countySlug]: false }));
      }
    },
    []
  );

  const refetchCoverage = useCallback(async () => {
    if (visibleZipIds.length === 0) return;
    setCoverageLoading(true);
    try {
      const merged: Record<string, number> = {};
      const CHUNK = 150;
      for (let i = 0; i < visibleZipIds.length; i += CHUNK) {
        const slice = visibleZipIds.slice(i, i + CHUNK);
        const qs = new URLSearchParams();
        qs.set("zipIds", slice.join(","));
        const res = await fetch(`/api/admin/pages/coverage?${qs.toString()}`);
        const json = await res.json().catch(() => ({}));
        const coverage = json?.coverage || {};
        Object.keys(coverage).forEach((zipId) => {
          const count = coverage?.[zipId]?.distinctServices;
          if (typeof count === "number") merged[zipId] = count;
        });
      }
      setZipServiceCoverage(merged);
    } finally {
      setCoverageLoading(false);
    }
  }, [visibleZipIds]);

  useEffect(() => {
    void refetchCoverage();
  }, [refetchCoverage]);

  const lastJobStatus = useRef<string | null>(null);

  useEffect(() => {
    const next = jobStatus?.status || null;
    if (next && next !== lastJobStatus.current) {
      lastJobStatus.current = next;
      if (next === "completed") {
        void refetchCoverage();
      }
    }
  }, [jobStatus?.status, refetchCoverage]);

  const toggleZipSelection = useCallback(
    (zipId: string) => {
      setSelectedZipPlaceIds((prev) => {
        const next = new Set(prev);
        if (next.has(zipId)) next.delete(zipId);
        else next.add(zipId);
        setSelectedCountySlugs(deriveSelectedCountySlugs(next));
        return next;
      });
    },
    [deriveSelectedCountySlugs]
  );

  const sleepFrame = useCallback(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())), []);

  const selectAllLocations = useCallback(async () => {
    setSelectingAllLocations(true);
    try {
      const slugs = counties.map((c) => c.countySlug).filter(Boolean);
      const lists = await Promise.all(
        slugs.map(async (slug) => {
          if (zipsByCounty[slug]?.length) return zipsByCounty[slug];
          return fetchZips(slug);
        })
      );
      const allZips = lists.flat();
      const ids = allZips.map((zip) => zip.id).filter(Boolean);
      setSelectAllProgress({ running: true, done: 0, total: ids.length });
      setSelectedZipPlaceIds(new Set());
      const CHUNK = 150;
      for (let i = 0; i < ids.length; i += CHUNK) {
        const slice = ids.slice(i, i + CHUNK);
        setSelectedZipPlaceIds((prev) => {
          const next = new Set(prev);
          slice.forEach((id) => next.add(id));
          return next;
        });
        setSelectAllProgress({ running: true, done: Math.min(i + CHUNK, ids.length), total: ids.length });
        await sleepFrame();
      }
      setSelectedCountySlugs(new Set(slugs));
      setSelectAllProgress({ running: false, done: ids.length, total: ids.length });
      setTimeout(() => setSelectAllProgress(null), 800);
    } finally {
      setSelectingAllLocations(false);
    }
  }, [counties, fetchZips, sleepFrame, zipsByCounty]);

  const toggleServiceSelection = useCallback(
    (serviceKey: string) => {
      const next = new Set(selectedServices);
      if (next.has(serviceKey)) next.delete(serviceKey);
      else next.add(serviceKey);
      setSelectedServices(next);
    },
    [selectedServices]
  );

  const loadServices = useCallback(async (q?: string) => {
    setServiceLoading(true);
    try {
      const res = await fetch(`/api/admin/services?limit=500&q=${encodeURIComponent(q || "")}`);
      const json = await res.json().catch(() => ({}));
      const items = Array.isArray(json.items) ? json.items : [];
      setServices(items);
    } finally {
      setServiceLoading(false);
    }
  }, []);

  const openEditService = useCallback((service: ServiceItem) => {
    setEditingServiceId(service.id);
    setEditingServiceName(service.name || "");
    setEditingServiceCategory(service.category || "");
    setEditingServiceMin(
      service.estimator?.baseMin != null ? String(service.estimator.baseMin) : ""
    );
    setEditingServiceMax(
      service.estimator?.baseMax != null ? String(service.estimator.baseMax) : ""
    );
    setEditingServiceUnit(service.estimator?.unit || "");
    setEditingServiceEnabled(service.enabled !== false);
    setEditingServiceInEstimator(service.inEstimator !== false);
    setEditingServiceInGenerator(service.inGenerator !== false);
  }, []);

  const handleAddService = useCallback(async () => {
    const name = newServiceName.trim();
    if (!name) return;
    const baseMin = newServiceMin ? Number(newServiceMin) : 0;
    const baseMax = newServiceMax ? Number(newServiceMax) : baseMin;
    const payload = {
      name,
      slug: newServiceKey.trim() || slugify(name),
      key: newServiceKey.trim() || slugify(name),
      category: newServiceCategory.trim() || null,
      description: newServiceDescription.trim() || null,
      enabled: newServiceEnabled,
      inEstimator: newServiceInEstimator,
      inGenerator: newServiceInGenerator,
      estimator: {
        enabled: newServiceInEstimator,
        baseMin,
        baseMax,
        unit: newServiceUnit.trim() || "job",
      },
    };
    const res = await fetch("/api/admin/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      setNewServiceOpen(false);
      setNewServiceName("");
      setNewServiceKey("");
      setNewServiceCategory("");
      setNewServiceDescription("");
      setNewServiceMin("");
      setNewServiceMax("");
      setNewServiceUnit("");
      setNewServiceEnabled(true);
      setNewServiceInEstimator(true);
      setNewServiceInGenerator(true);
      void loadServices(serviceSearch);
    }
  }, [
    loadServices,
    newServiceCategory,
    newServiceDescription,
    newServiceInEstimator,
    newServiceInGenerator,
    newServiceKey,
    newServiceMax,
    newServiceMin,
    newServiceName,
    newServiceEnabled,
    newServiceUnit,
    serviceSearch,
  ]);

  const handleUpdateService = useCallback(
    async (id: string, payload: Partial<ServiceItem>) => {
      await fetch(`/api/admin/services/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      await loadServices(serviceSearch);
    },
    [loadServices, serviceSearch]
  );

  const handleDeleteService = useCallback(
    async (id: string) => {
      const ok = window.confirm("Delete this service and all pages for it?");
      if (!ok) return;
      const res = await fetch(`/api/admin/services/${encodeURIComponent(id)}?cascade=1`, {
        method: "DELETE",
      });
      if (res.ok) {
        await fetch("/api/admin/pages/purge-by-service", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ serviceKey: id }),
        });
        setSelectedServices((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        await loadServices(serviceSearch);
        await refetchCoverage();
      }
    },
    [loadServices, refetchCoverage, serviceSearch]
  );

  const handleGenerate = useCallback(async () => {
    setGenerateError(null);
    const zipPlaceIds = Array.from(selectedZipPlaceIds);
    const serviceKeys = Array.from(selectedServices);
    if (!zipPlaceIds.length) {
      setGenerateError("Select at least 1 location.");
      return;
    }
    if (!serviceKeys.length) {
      setGenerateError("Select at least 1 service.");
      return;
    }
    const maxPagesValue = Number(maxPages) || undefined;
    if ((maxPagesValue && maxPagesValue > 500) || totalPages > 500) {
      const ok = window.confirm("This will generate a large batch of pages. Continue?");
      if (!ok) return;
    }
    const payload = {
      zipPlaceIds,
      serviceKeys,
      publish: publishOnCreate,
      maxPages: maxPagesValue,
    };
    console.log("generate payload:", payload);
    const res = await fetch("/api/admin/pages/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const contentType = res.headers.get("content-type") || "";
    const rawText = await res.text();
    console.log("generate response meta", {
      status: res.status,
      contentType,
      bodyLen: rawText.length,
    });
    let json: any = null;
    if (rawText) {
      try {
        json = JSON.parse(rawText);
      } catch {
        json = null;
      }
    }
    if (!res.ok || !json?.ok) {
      console.error("generate failed:", res.status, {
        contentType,
        rawText: rawText?.slice(0, 800),
        json,
      });
      const msg = json?.message || rawText || `HTTP ${res.status} (empty response body)`;
      setGenerateError(msg);
      return;
    }
    setJobId(json.jobId);
  }, [maxPages, publishOnCreate, selectedServices, selectedZipPlaceIds, totalPages]);

  const handleCancelJob = useCallback(async () => {
    if (!jobId) return;
    await fetch(`/api/admin/pages/generate/cancel?jobId=${encodeURIComponent(jobId)}`, { method: "POST" });
  }, [jobId]);

  const setLock = useCallback(
    async (locked: boolean) => {
      setLockMessage(null);
      const res = await fetch("/api/admin/geo/lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locked }),
      });
      const json = await res.json().catch(() => ({}));
      setLockMessage(res.ok ? `Geo ${locked ? "locked" : "unlocked"}.` : json?.error || "Lock update failed.");
      await refreshHealth();
    },
    [refreshHealth]
  );

  const handleResetToZip = useCallback(async () => {
    setImportMessage(null);
    const res = await fetch("/api/admin/geo/reset-to-zip", { method: "POST" });
    const json = await res.json().catch(() => ({}));
    setImportMessage(res.ok ? "Reset complete." : json?.error || "Reset failed.");
    setGeoActionJson(JSON.stringify(json, null, 2));
    await refreshHealth();
  }, [refreshHealth]);

  const handleImportZips = useCallback(async () => {
    setImportMessage(null);
    const res = await fetch(`/api/admin/geo/import-zips?countySlug=${encodeURIComponent(importCountySlug)}`, { method: "POST" });
    const json = await res.json().catch(() => ({}));
    setImportMessage(res.ok ? `Imported ${importCountySlug}.` : json?.error || "Import failed.");
    setGeoActionJson(JSON.stringify(json, null, 2));
    await refreshHealth();
    await fetchZips(importCountySlug);
  }, [fetchZips, importCountySlug, refreshHealth]);

  const handleSeedServices = useCallback(async () => {
    setSeedMessage(null);
    const res = await fetch("/api/admin/services/seed?force=1", { method: "POST" });
    const json = await res.json().catch(() => ({}));
    setSeedMessage(
      res.ok
        ? `Seeded services. Inserted ${json?.inserted ?? 0}, updated ${json?.updated ?? 0}.`
        : json?.error || "Seed failed."
    );
    await loadServices(serviceSearch);
  }, [loadServices, serviceSearch]);

  const purgePages = useCallback(async () => {
    const res = await fetch("/api/admin/pages/purge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: purgeConfirm }),
    });
    const json = await res.json().catch(() => ({}));
    setPurgeMessage(res.ok ? `Deleted ${json.deletedCount || 0} pages.` : json?.error || "Purge failed.");
  }, [purgeConfirm]);

  const handleUploadCsv = useCallback(async () => {
    if (!csvFile || !csvCountySlug) return;
    setCsvUploading(true);
    setCsvUploadStatus(null);
    setCsvUploadJson(null);
    try {
      const form = new FormData();
      form.set("file", csvFile);
      const res = await fetch(`/api/admin/geo/upload-csv?countySlug=${encodeURIComponent(csvCountySlug)}`, {
        method: "POST",
        body: form,
      });
      const json = await res.json().catch(() => ({}));
      setCsvUploadStatus(res.ok ? "Upload complete." : json?.error || "Upload failed.");
      setCsvUploadJson(JSON.stringify(json, null, 2));
      await fetchZips(csvCountySlug);
    } finally {
      setCsvUploading(false);
    }
  }, [csvCountySlug, csvFile, fetchZips]);

  const clearCsvModal = useCallback(() => {
    setCsvCountySlug("");
    setCsvFile(null);
    setCsvUploadStatus(null);
    setCsvUploadJson(null);
    setCsvUploading(false);
    setCsvDragActive(false);
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => {
      void loadServices(serviceSearch);
    }, 200);
    return () => clearTimeout(handle);
  }, [loadServices, serviceSearch]);

  useEffect(() => {
    const q = searchTerm.trim();
    if (!q) {
      setSearchResults([]);
      setSearchMessage("");
      return;
    }
    let active = true;
    setSearchLoading(true);
    const handle = setTimeout(async () => {
      const res = await fetch(
        `/api/admin/geo/zip-places/search?q=${encodeURIComponent(q)}&limit=200`
      );
      const json = await res.json().catch(() => ({}));
      if (!active) return;
      const items = Array.isArray(json.items) ? json.items : [];
      setSearchResults(items);
      setSearchMessage(items.length ? "" : "No matches.");
      setSearchLoading(false);
    }, 250);
    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [searchTerm]);

  const locationsList = useMemo(() => {
    const selectedSvcCount = selectedServices.size;

    // SEARCH MODE (keeps your existing behavior)
    if (searchTerm.trim()) {
      const normalizeZipId = (place: ZipPlace) => {
        // If search returns a zip doc id, keep it
        if (place.id && zipById[place.id]) return place.id;
        // Otherwise normalize to zip doc id format
        if (place.countySlug && place.zip) return `ca-${place.countySlug}-${place.zip}`;
        return place.id;
      };

      return (
        <div className="mt-4 space-y-2">
          {searchLoading && <div className="text-xs text-slate-400">Searching...</div>}
          {!searchLoading && searchMessage && <div className="text-xs text-slate-400">{searchMessage}</div>}

          {searchResults.map((place) => {
            const zipId = normalizeZipId(place);
            const selected = selectedZipPlaceIds.has(zipId);

            const existingSvcCount = zipServiceCoverage[zipId] ?? 0;
            return (
              <button
                key={place.id}
                type="button"
                onClick={() => toggleZipSelection(zipId)}
                className="flex w-full items-center gap-3 rounded-2xl border border-slate-800/60 bg-slate-950/20 px-4 py-3 text-left transition hover:bg-white/5"
              >
                <span
                  className={[
                    "grid h-10 w-10 place-items-center rounded-2xl border",
                    selected ? "border-emerald-300/50 bg-emerald-500/10" : "border-slate-700 bg-slate-950/30",
                  ].join(" ")}
                  aria-hidden="true"
                >
                  <span
                    className={[
                      "h-5 w-5 rounded-full border",
                      selected ? "border-emerald-300/60 bg-emerald-400/40" : "border-slate-600 bg-transparent",
                    ].join(" ")}
                  />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-100">{place.zip}</div>
                  <div className="text-xs text-slate-400">{place.placeName} - {place.countySlug}</div>
                </div>
                <div className="ml-auto rounded-full border border-slate-700 bg-slate-950/40 px-3 py-1 text-xs text-slate-200">
                  {existingSvcCount}/{selectedSvcCount} services
                </div>
              </button>
            );
          })}
        </div>
      );
    }

    if (!counties.length) {
      return <div className="mt-4 text-xs text-slate-400">No counties loaded.</div>;
    }

    const defaultVisibleCount = isMobile ? 50 : 200;

    return (
      <div className="mt-4 space-y-3">
        {coverageLoading && (
          <div className="text-xs text-slate-500">Updating service coverage...</div>
        )}
        {counties.map((county) => {
          const countySlug = county.countySlug;
          const countyZips = zipsByCounty[countySlug] || [];
          const isLoading = Boolean(zipLoadingByCounty[countySlug]);
          const visibleCount = mobileCountyZipVisible[countySlug] ?? defaultVisibleCount;
          const visibleZips = countyZips.slice(0, visibleCount);
          const hasMore = countyZips.length > visibleZips.length;

          return (
            <div key={countySlug} className="rounded-2xl border border-slate-800/60 bg-slate-950/40">
              <div className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="text-sm font-semibold text-slate-100">{county.name}</div>
                  <div className="text-xs text-slate-400">
                    {isLoading ? "Loading..." : `${countyZips.length} ZIPs`}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!countyZips.length && !isLoading) void fetchZips(countySlug);
                  }}
                  className="text-xs text-slate-300 hover:text-white"
                >
                  Load
                </button>
              </div>

              <div className="px-3 pb-3">
                {isLoading && countyZips.length === 0 && (
                  <div className="px-2 py-2 text-xs text-slate-400">Loading ZIPs...</div>
                )}
                {!isLoading && countyZips.length === 0 && (
                  <div className="px-2 py-2 text-xs text-slate-400">No ZIPs loaded for this county.</div>
                )}
                <div className="space-y-2">
                  {visibleZips.map((zip) => {
                    const selected = selectedZipPlaceIds.has(zip.id);
                    const existingSvcCount = zipServiceCoverage[zip.id] ?? 0;
                    return (
                      <button
                        key={zip.id}
                        type="button"
                        onClick={() => toggleZipSelection(zip.id)}
                        className="flex w-full items-center gap-3 rounded-2xl border border-slate-800/60 bg-slate-950/20 px-4 py-3 text-left transition hover:bg-white/5"
                      >
                        <span
                          className={[
                            "grid h-10 w-10 place-items-center rounded-2xl border",
                            selected ? "border-emerald-300/50 bg-emerald-500/10" : "border-slate-700 bg-slate-950/30",
                          ].join(" ")}
                          aria-hidden="true"
                        >
                          <span
                            className={[
                              "h-5 w-5 rounded-full border",
                              selected ? "border-emerald-300/60 bg-emerald-400/40" : "border-slate-600 bg-transparent",
                            ].join(" ")}
                          />
                        </span>

                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-slate-100">{zip.zip}</div>
                          <div className="text-xs text-slate-400">
                            {zip.primaryPlaceName || "ZIP"} - {zip.countySlug}
                          </div>
                        </div>
                        <div className="ml-auto rounded-full border border-slate-700 bg-slate-950/40 px-3 py-1 text-xs text-slate-200">
                          {existingSvcCount}/{selectedSvcCount} services
                        </div>
                      </button>
                    );
                  })}
                </div>

                {hasMore && (
                  <button
                    type="button"
                    onClick={() =>
                      setMobileCountyZipVisible((prev) => ({
                        ...prev,
                        [countySlug]: (prev[countySlug] ?? defaultVisibleCount) + (isMobile ? 50 : 200),
                      }))
                    }
                    className="mt-2 text-xs text-slate-400 hover:text-slate-200"
                  >
                    Load more ZIPs
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }, [
    counties,
    coverageLoading,
    fetchZips,
    isMobile,
    mobileCountyZipVisible,
    searchLoading,
    searchMessage,
    searchResults,
    searchTerm,
    selectedServices,
    selectedZipPlaceIds,
    toggleZipSelection,
    zipById,
    zipLoadingByCounty,
    zipServiceCoverage,
    zipsByCounty,
  ]);

  const servicesList = useMemo(() => {
    return (
      <div className="mt-4 space-y-3">
        <div className="flex items-center gap-2">
          <input
            value={serviceSearch}
            onChange={(e) => setServiceSearch(e.target.value)}
            placeholder="Search services"
            className="h-12 w-full rounded-2xl border border-slate-800 bg-slate-950/40 px-4 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
          />
        </div>
        <div className="rounded-2xl border border-slate-800/60 bg-slate-950/30">
          <div className="max-h-[520px] overflow-y-auto p-2 dark-scroll">
            <div className="space-y-3">
              {serviceLoading && <div className="text-xs text-slate-400">Loading services...</div>}
              {!serviceLoading && visibleServices.length === 0 && <div className="text-xs text-slate-400">No services found.</div>}
              {visibleServices.map((service) => {
                const key = service.slug || service.key || service.id;
                const selected = selectedServices.has(key);
                return (
                  <div key={service.id} className="flex items-center gap-2 rounded-2xl border border-slate-800/60 bg-slate-950/20 px-4 py-4">
                    <SelectionButton selected={selected} onClick={() => toggleServiceSelection(key)} label={`Select ${service.name}`} />
                    <div className="flex-1">
                      <div className="text-sm text-slate-100">{service.name}</div>
                      <div className="text-xs text-slate-400">{service.category || "Service"}</div>
                    </div>
                    <button
                      type="button"
                      className="h-9 rounded-xl border border-slate-700 bg-slate-950/40 px-4 text-xs text-slate-100 hover:bg-white/5"
                      onClick={() => openEditService(service)}
                    >
                      Edit
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        {filteredServices.length > visibleServices.length && (
          <button
            type="button"
            onClick={() => {
              if (isMobile) setMobileServiceVisible((prev) => prev + 50);
              else setServiceVisible((prev) => prev + 200);
            }}
            className="mt-1 text-xs text-slate-400"
          >
            Load more services
          </button>
        )}
      </div>
    );
  }, [
    filteredServices.length,
    isMobile,
    openEditService,
    selectedServices,
    serviceLoading,
    serviceSearch,
    toggleServiceSelection,
    visibleServices,
  ]);

  const header = (
    <header className="border-b border-slate-800 bg-slate-950/95 px-4 py-3 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-lg font-semibold">Generate ZIP Pages</div>
          <div className="text-xs text-slate-400">ZIP-first locations, single service source, production-ready imports</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex min-h-[44px] w-full items-center gap-2 rounded-full border border-slate-800 bg-slate-900/60 px-3 sm:w-auto">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
              }}
              placeholder="Search ZIP or place"
              className="min-h-[44px] w-full border-0 bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-0 sm:w-56"
            />
          </div>
          <button
            onClick={() => setNewServiceOpen(true)}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 text-xs font-semibold"
          >
            <Plus className="h-4 w-4" />
            Add service
          </button>
          <button
            onClick={() => setAdvancedOpen((prev) => !prev)}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 text-xs font-semibold"
          >
            <Settings className="h-4 w-4" />
            Advanced
          </button>
        </div>
      </div>
    </header>
  );

  return (
    <>
      <GeneratorShell header={header}>
        <div className="flex min-h-screen flex-col">
          <main className={isMobile ? "flex-1 min-h-0 overflow-auto px-4 py-4 pb-28" : "flex-1 min-h-0 px-6 py-4"}>
            {isMobile ? (
              <div className="space-y-4">
                <SelectorCard
                  title="Locations"
                  subtitle="ZIP + Place"
                  count={selectedZipPlaceIds.size}
                  actionLabel="Select"
                  onAction={() => setLocationsOpen(true)}
                  rightSlot={
                    <button
                      onClick={() => setCsvOpen(true)}
                      className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 text-xs font-semibold"
                    >
                      <Upload className="h-4 w-4" />
                      Add
                    </button>
                  }
                />
                <SelectorCard
                  title="Services"
                  subtitle="Service taxonomy"
                  count={selectedServices.size}
                  actionLabel="Select"
                  onAction={() => setServicesOpen(true)}
                  rightSlot={
                    <button
                      onClick={() => setNewServiceOpen(true)}
                      className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 text-xs font-semibold"
                    >
                      <Plus className="h-4 w-4" />
                      Add
                    </button>
                  }
                />
                <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 text-xs text-slate-400">
                  <div>Selected counties: {selectedCountyCount}</div>
                  <div>Selected places: {selectedZipPlaceIds.size}</div>
                  <div>Selected services: {selectedServices.size}</div>
                  <div className="mt-2">Pages: {totalPages}</div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <GeneratorStatusPanel
                  selectedPlaces={selectedZipPlaceIds.size}
                  selectedServices={selectedServices.size}
                  totalPages={totalPages}
                  estimatedSeconds={estimatedSeconds}
                  jobStatus={jobStatus || null}
                  selectAllProgress={selectAllProgress}
                />
                <div className="grid h-full min-h-0 grid-cols-12 gap-4">
                  <section className="col-span-7 flex min-h-0 flex-col rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold">Locations</div>
                        <div className="text-xs text-slate-400">Counties, ZIPs, and Places</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => void selectAllLocations()}
                          disabled={selectingAllLocations}
                          className="h-11 rounded-lg border border-slate-700 bg-slate-950 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {selectingAllLocations ? "Selecting..." : "Select all"}
                        </button>
                        <button
                          onClick={() => setCsvOpen(true)}
                          className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 text-xs font-semibold"
                        >
                          <Upload className="h-4 w-4" />
                          Add locations
                        </button>
                        <button className="h-11 rounded-lg border border-slate-700 bg-slate-950 px-3 text-xs" onClick={clearSelection}>
                          Clear selection
                        </button>
                      </div>
                    </div>
                    {locationsList}
                  </section>

                  <section className="col-span-5 flex min-h-0 flex-col rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold">Services</div>
                        <div className="text-xs text-slate-400">Single source from Firestore</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedServices(new Set())}
                          className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 text-xs"
                        >
                          Clear selection
                        </button>
                        <button
                          onClick={selectAllServices}
                          className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 text-xs"
                        >
                          Select all
                        </button>
                        <button
                          onClick={() => loadServices(serviceSearch)}
                          className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 text-xs"
                        >
                          <RefreshCcw className="h-4 w-4" />
                          Refresh
                        </button>
                      </div>
                    </div>
                    {servicesList}
                  </section>
                </div>
              </div>
            )}

            <div className="mt-4 px-4 sm:px-6">
              <AdvancedGeoTools open={advancedOpen} onToggle={() => setAdvancedOpen((prev) => !prev)}>
                <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                  <div className="text-xs font-semibold uppercase text-slate-400">Geo status</div>
                  <div className="mt-2 flex items-center justify-between">
                    <span>Locked: {health?.locked ? "Yes" : "No"}</span>
                    <button
                      className="h-11 rounded-lg border border-slate-700 bg-slate-950 px-3"
                      onClick={() => setLock(!health?.locked)}
                    >
                      {health?.locked ? "Unlock" : "Lock"}
                    </button>
                  </div>
                  {lockMessage && <div className="mt-2 text-slate-400">{lockMessage}</div>}
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      className="h-11 rounded-lg border border-slate-700 bg-slate-950 px-3"
                      onClick={() => {
                        if (!confirm("Reset geo data to ZIP model? This deletes existing ZIP collections.")) return;
                        void handleResetToZip();
                      }}
                      disabled={health?.locked}
                    >
                      Reset to ZIP model
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                  <div className="text-xs font-semibold uppercase text-slate-400">Import ZIPs</div>
                  <div className="mt-3 flex items-center gap-2">
                    <select
                      value={importCountySlug}
                      onChange={(e) => setImportCountySlug(e.target.value)}
                      className="h-11 rounded-md border border-slate-700 bg-slate-950 px-2"
                    >
                      <option value="los-angeles">Los Angeles</option>
                      <option value="orange">Orange</option>
                      <option value="ventura">Ventura</option>
                      <option value="san-bernardino">San Bernardino</option>
                    </select>
                    <button
                      className="h-11 rounded-lg border border-slate-700 bg-slate-950 px-3"
                      onClick={handleImportZips}
                      disabled={health?.locked}
                    >
                      Import
                    </button>
                  </div>
                  {importMessage && <div className="mt-2 text-slate-400">{importMessage}</div>}
                  {geoActionJson && (
                    <pre className="mt-2 max-h-36 overflow-auto rounded-lg border border-slate-800 bg-slate-950 p-2 text-[11px] text-slate-400">
                      {geoActionJson}
                    </pre>
                  )}
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                  <div className="text-xs font-semibold uppercase text-slate-400">Services</div>
                  <div className="mt-3 flex items-center gap-2">
                    <button className="h-11 rounded-lg border border-slate-700 bg-slate-950 px-3 text-xs" onClick={() => void handleSeedServices()}>
                      Seed services
                    </button>
                  </div>
                  {seedMessage && <div className="mt-2 text-slate-400">{seedMessage}</div>}
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                  <div className="text-xs font-semibold uppercase text-slate-400">Purge pages</div>
                  <div className="mt-2 text-xs text-slate-400">Deletes ALL pages. Type DELETE ALL to confirm.</div>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      value={purgeConfirm}
                      onChange={(e) => setPurgeConfirm(e.target.value)}
                      placeholder="DELETE ALL"
                      className="h-11 w-36 rounded-md border border-slate-700 bg-slate-950 px-2"
                    />
                    <button
                      onClick={purgePages}
                      disabled={purgeConfirm != "DELETE ALL"}
                      className="inline-flex h-11 items-center gap-2 rounded-md border border-rose-700 px-3 text-rose-300"
                    >
                      <Trash2 className="h-4 w-4" />
                      Purge
                    </button>
                  </div>
                  {purgeMessage && <div className="mt-2 text-rose-300">{purgeMessage}</div>}
                </div>
              </AdvancedGeoTools>
            </div>
          </main>

          <StickyGenerateBar
            publishOnCreate={publishOnCreate}
            onTogglePublish={setPublishOnCreate}
            maxPages={maxPages}
            onMaxPagesChange={setMaxPages}
            onGenerate={handleGenerate}
            onCancel={handleCancelJob}
            generateDisabled={generateDisabled}
            helperText={selectionHelper}
            jobStatus={jobStatus || null}
            progressPct={progressPct}
            elapsedDisplay={elapsedDisplay}
            etaDisplay={etaDisplay}
            isMobile={isMobile}
          />
        </div>

        <MobileSelectorSheet
          open={isMobile && locationsOpen}
          onOpenChange={setLocationsOpen}
          title="Locations"
          searchSlot={
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search ZIP or place"
              className="h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs text-slate-200"
            />
          }
          onClear={clearSelection}
          onDone={() => setLocationsOpen(false)}
        >
          {locationsList}
        </MobileSelectorSheet>

        <MobileSelectorSheet
          open={isMobile && servicesOpen}
          onOpenChange={setServicesOpen}
          title="Services"
          searchSlot={
            <input
              value={serviceSearch}
              onChange={(e) => setServiceSearch(e.target.value)}
              placeholder="Search services"
              className="h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs text-slate-200"
            />
          }
          onClear={() => setSelectedServices(new Set())}
          onLoadMore={() => setMobileServiceVisible((prev) => prev + 50)}
          hasMore={filteredServices.length > (isMobile ? mobileServiceVisible : serviceVisible)}
          onDone={() => setServicesOpen(false)}
        >
          {servicesList}
        </MobileSelectorSheet>
      </GeneratorShell>

      {csvOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/70" onClick={() => { setCsvOpen(false); clearCsvModal(); }} />
          <div
              className={
                isMobile
                ? "absolute bottom-0 left-0 right-0 max-h-[85vh] rounded-t-3xl border-t border-slate-800 bg-slate-950 p-6"
                : "absolute left-1/2 top-1/2 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-800 bg-slate-950 p-6"
            }
          >
            {isMobile && <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-white/20" />}
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Upload locations CSV</div>
              <button onClick={() => { setCsvOpen(false); clearCsvModal(); }}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 text-xs text-slate-400">Required columns: zip, place, county, state. Optional: lat, lng.</div>

            <div className="mt-4 flex items-center gap-2 text-xs">
              <span>County</span>
              <select
                value={csvCountySlug}
                onChange={(e) => setCsvCountySlug(e.target.value)}
                className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1"
              >
                {counties.map((county) => (
                  <option key={county.id} value={county.countySlug}>
                    {county.name}
                  </option>
                ))}
              </select>
            </div>

            <div
              className={`mt-4 rounded-xl border-2 border-dashed px-4 py-6 text-center text-xs transition ${
                csvDragActive ? "border-emerald-400 bg-emerald-400/10" : "border-slate-700"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setCsvDragActive(true);
              }}
              onDragLeave={() => setCsvDragActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setCsvDragActive(false);
                const file = e.dataTransfer.files?.[0];
                if (file) setCsvFile(file);
              }}
            >
              <div className="text-slate-300">Drag and drop CSV here</div>
              <div className="mt-2 text-slate-500">or</div>
              <label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-700 px-3 py-1">
                <Upload className="h-4 w-4" />
                <span>Choose file</span>
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setCsvFile(file);
                  }}
                />
              </label>
            </div>

            {csvFile && <div className="mt-3 text-xs text-slate-400">Selected: {csvFile.name}</div>}

            {csvUploadStatus && <div className="mt-3 text-xs text-slate-300">{csvUploadStatus}</div>}
            {csvUploadJson && (
              <pre className="mt-2 max-h-40 overflow-auto rounded-lg border border-slate-800 bg-slate-900/40 p-2 text-[11px] text-slate-400">
                {csvUploadJson}
              </pre>
            )}

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                className="h-10 rounded-md border border-slate-700 px-3 text-xs"
                onClick={() => { setCsvOpen(false); clearCsvModal(); }}
              >
                Cancel
              </button>
              <button
                className="h-10 rounded-md bg-emerald-400 px-3 text-xs font-semibold text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-600"
                disabled={!csvFile || !csvCountySlug || csvUploading}
                onClick={handleUploadCsv}
              >
                {csvUploading ? "Uploading..." : "Upload & import"}
              </button>
            </div>
          </div>
        </div>
      )}

      {newServiceOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/70" onClick={() => setNewServiceOpen(false)} />
          <div
              className={
                isMobile
                ? "absolute bottom-0 left-0 right-0 max-h-[85vh] rounded-t-3xl border-t border-slate-800 bg-slate-950 p-5"
                : "absolute left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-800 bg-slate-950 p-5"
            }
          >
            {isMobile && <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-white/20" />}
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Add service</div>
              <button onClick={() => setNewServiceOpen(false)}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 space-y-3 text-xs text-slate-300">
              <input
                value={newServiceName}
                onChange={(e) => setNewServiceName(e.target.value)}
                placeholder="Service name"
                className="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3"
              />
              <input
                value={newServiceKey}
                onChange={(e) => setNewServiceKey(e.target.value)}
                placeholder={`Service key (auto: ${slugify(newServiceName || "")})`}
                className="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3"
              />
              <input
                value={newServiceCategory}
                onChange={(e) => setNewServiceCategory(e.target.value)}
                placeholder="Category"
                className="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3"
              />
              <input
                value={newServiceDescription}
                onChange={(e) => setNewServiceDescription(e.target.value)}
                placeholder="Description"
                className="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={newServiceMin}
                  onChange={(e) => setNewServiceMin(e.target.value)}
                  placeholder="Estimator min ($)"
                  className="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3"
                />
                <input
                  value={newServiceMax}
                  onChange={(e) => setNewServiceMax(e.target.value)}
                  placeholder="Estimator max ($)"
                  className="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={newServiceUnit}
                  onChange={(e) => setNewServiceUnit(e.target.value)}
                  placeholder="Unit"
                  className="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3"
                />
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={newServiceEnabled}
                    onChange={(e) => setNewServiceEnabled(e.target.checked)}
                  />
                  Enabled
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={newServiceInEstimator}
                    onChange={(e) => setNewServiceInEstimator(e.target.checked)}
                  />
                  In estimator
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={newServiceInGenerator}
                    onChange={(e) => setNewServiceInGenerator(e.target.checked)}
                  />
                  In generator
                </div>
              </div>
              <button
                onClick={handleAddService}
                className="h-10 w-full rounded-md bg-emerald-400 px-3 text-xs font-semibold text-slate-900"
              >
                Add service
              </button>
            </div>
          </div>
        </div>
      )}

      {editingServiceId && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/70" onClick={() => setEditingServiceId(null)} />
          <div
              className={
                isMobile
                ? "absolute bottom-0 left-0 right-0 max-h-[85vh] rounded-t-3xl border-t border-slate-800 bg-slate-950 p-5"
                : "absolute left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-800 bg-slate-950 p-5"
            }
          >
            {isMobile && <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-white/20" />}
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Edit service</div>
              <button onClick={() => setEditingServiceId(null)}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 space-y-3 text-xs text-slate-300">
              <input
                value={editingServiceName}
                onChange={(e) => setEditingServiceName(e.target.value)}
                placeholder="Service name"
                className="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3"
              />
              <input
                value={editingServiceCategory}
                onChange={(e) => setEditingServiceCategory(e.target.value)}
                placeholder="Category"
                className="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={editingServiceMin}
                  onChange={(e) => setEditingServiceMin(e.target.value)}
                  placeholder="Estimator min ($)"
                  className="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3"
                />
                <input
                  value={editingServiceMax}
                  onChange={(e) => setEditingServiceMax(e.target.value)}
                  placeholder="Estimator max ($)"
                  className="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={editingServiceUnit}
                  onChange={(e) => setEditingServiceUnit(e.target.value)}
                  placeholder="Unit"
                  className="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3"
                />
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={editingServiceEnabled}
                    onChange={(e) => setEditingServiceEnabled(e.target.checked)}
                  />
                  Enabled
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={editingServiceInEstimator}
                    onChange={(e) => setEditingServiceInEstimator(e.target.checked)}
                  />
                  In estimator
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={editingServiceInGenerator}
                    onChange={(e) => setEditingServiceInGenerator(e.target.checked)}
                  />
                  In generator
                </div>
              </div>
              <button
                onClick={async () => {
                  await handleUpdateService(editingServiceId, {
                    name: editingServiceName.trim(),
                    category: editingServiceCategory.trim() || null,
                    enabled: editingServiceEnabled,
                    inEstimator: editingServiceInEstimator,
                    inGenerator: editingServiceInGenerator,
                    estimator: {
                      enabled: editingServiceInEstimator,
                      baseMin: editingServiceMin ? Number(editingServiceMin) : 0,
                      baseMax: editingServiceMax ? Number(editingServiceMax) : 0,
                      unit: editingServiceUnit.trim() || "job",
                    },
                  });
                  setEditingServiceId(null);
                }}
                className="h-10 w-full rounded-md bg-emerald-400 px-3 text-xs font-semibold text-slate-900"
              >
                Save changes
              </button>
              <button
                onClick={async () => {
                  await handleDeleteService(editingServiceId);
                  setEditingServiceId(null);
                }}
                className="h-10 w-full rounded-md border border-rose-700/60 px-3 text-xs font-semibold text-rose-300"
              >
                Delete service
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
