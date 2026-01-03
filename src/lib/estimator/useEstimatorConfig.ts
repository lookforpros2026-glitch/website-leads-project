"use client";

import { useEffect, useState } from "react";

export type EstimatorService = {
  key: string;
  name: string;
  category?: string;
  enabled?: boolean;
  sort?: number;
  baseMin?: number;
  baseMax?: number;
  durationMinDays?: number;
  durationMaxDays?: number;
  unit?: "job" | "sqft" | "linear_ft";
};

export function useEstimatorConfig() {
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<EstimatorService[]>([]);
  const [config, setConfig] = useState<any>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`/api/site/estimator/config?t=${Date.now()}`, { cache: "no-store" });
        const j = await r.json().catch(() => ({}));
        if (!alive) return;
        setConfig(j.config || null);
        setServices(j.config?.services || []);
      } catch {
        if (!alive) return;
        setConfig(null);
        setServices([]);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return { loading, services, config };
}
