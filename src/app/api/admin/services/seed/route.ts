import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin/authz";
import { slugify } from "@/lib/slug";

type SeedService = {
  name: string;
  slug: string;
  category: string;
  enabled: boolean;
  inEstimator: boolean;
  inGenerator: boolean;
  estimator?: {
    enabled: boolean;
    baseMin: number;
    baseMax: number;
    unit: "job" | "sqft" | "linear_ft";
  };
};

const SEED_SERVICES: SeedService[] = [
  { name: "Kitchen Remodeling", slug: "kitchen-remodeling", category: "Interior", enabled: true, inEstimator: true, inGenerator: true, estimator: { enabled: true, baseMin: 15000, baseMax: 60000, unit: "job" } },
  { name: "Bathroom Remodeling", slug: "bathroom-remodeling", category: "Interior", enabled: true, inEstimator: true, inGenerator: true, estimator: { enabled: true, baseMin: 12000, baseMax: 45000, unit: "job" } },
  { name: "Home Remodeling", slug: "home-remodeling", category: "General", enabled: true, inEstimator: true, inGenerator: true, estimator: { enabled: true, baseMin: 25000, baseMax: 150000, unit: "job" } },
  { name: "Room Addition", slug: "room-addition", category: "ADU & Additions", enabled: true, inEstimator: true, inGenerator: true, estimator: { enabled: true, baseMin: 20000, baseMax: 120000, unit: "job" } },
  { name: "ADU Construction", slug: "adu-construction", category: "ADU & Additions", enabled: true, inEstimator: true, inGenerator: true, estimator: { enabled: true, baseMin: 85000, baseMax: 250000, unit: "job" } },
  { name: "Roof Replacement", slug: "roof-replacement", category: "Roofing", enabled: true, inEstimator: true, inGenerator: true, estimator: { enabled: true, baseMin: 7000, baseMax: 25000, unit: "job" } },
  { name: "Roof Repair", slug: "roof-repair", category: "Roofing", enabled: true, inEstimator: true, inGenerator: true, estimator: { enabled: true, baseMin: 2500, baseMax: 12000, unit: "job" } },
  { name: "Foundation Repair", slug: "foundation-repair", category: "Foundation", enabled: true, inEstimator: true, inGenerator: true, estimator: { enabled: true, baseMin: 3000, baseMax: 25000, unit: "job" } },
  { name: "Seismic Retrofit", slug: "seismic-retrofit", category: "Foundation", enabled: true, inEstimator: true, inGenerator: true, estimator: { enabled: true, baseMin: 2500, baseMax: 12000, unit: "job" } },
  { name: "Concrete Work", slug: "concrete-work", category: "Concrete & Masonry", enabled: true, inEstimator: true, inGenerator: true, estimator: { enabled: true, baseMin: 2500, baseMax: 18000, unit: "job" } },
  { name: "Electrical Panel Upgrade", slug: "electrical-panel-upgrade", category: "Electrical", enabled: true, inEstimator: true, inGenerator: true, estimator: { enabled: true, baseMin: 1500, baseMax: 6000, unit: "job" } },
  { name: "Electrical Rewiring", slug: "electrical-rewiring", category: "Electrical", enabled: true, inEstimator: true, inGenerator: true, estimator: { enabled: true, baseMin: 4000, baseMax: 20000, unit: "job" } },
  { name: "Lighting Installation", slug: "lighting-installation", category: "Electrical", enabled: true, inEstimator: true, inGenerator: true, estimator: { enabled: true, baseMin: 250, baseMax: 1800, unit: "job" } },
  { name: "Plumbing Repiping", slug: "plumbing-repiping", category: "Plumbing", enabled: true, inEstimator: true, inGenerator: true, estimator: { enabled: true, baseMin: 4000, baseMax: 25000, unit: "job" } },
  { name: "Plumbing Repair", slug: "plumbing-repair", category: "Plumbing", enabled: true, inEstimator: true, inGenerator: true, estimator: { enabled: true, baseMin: 200, baseMax: 1800, unit: "job" } },
  { name: "Water Heater Installation", slug: "water-heater-installation", category: "Plumbing", enabled: true, inEstimator: true, inGenerator: true, estimator: { enabled: true, baseMin: 1200, baseMax: 4500, unit: "job" } },
  { name: "HVAC Installation", slug: "hvac-installation", category: "HVAC", enabled: true, inEstimator: true, inGenerator: true, estimator: { enabled: true, baseMin: 3500, baseMax: 12000, unit: "job" } },
  { name: "HVAC Repair", slug: "hvac-repair", category: "HVAC", enabled: true, inEstimator: true, inGenerator: true, estimator: { enabled: true, baseMin: 350, baseMax: 2500, unit: "job" } },
  { name: "Flooring Installation", slug: "flooring-installation", category: "Flooring & Tile", enabled: true, inEstimator: true, inGenerator: true, estimator: { enabled: true, baseMin: 1500, baseMax: 12000, unit: "job" } },
  { name: "Tile Installation", slug: "tile-installation", category: "Flooring & Tile", enabled: true, inEstimator: true, inGenerator: true, estimator: { enabled: true, baseMin: 1500, baseMax: 12000, unit: "job" } },
  { name: "Drywall Installation & Repair", slug: "drywall-installation-repair", category: "Drywall", enabled: true, inEstimator: true, inGenerator: true, estimator: { enabled: true, baseMin: 800, baseMax: 4500, unit: "job" } },
  { name: "Interior Painting", slug: "interior-painting", category: "Painting", enabled: true, inEstimator: true, inGenerator: true, estimator: { enabled: true, baseMin: 800, baseMax: 4500, unit: "job" } },
  { name: "Exterior Painting", slug: "exterior-painting", category: "Painting", enabled: true, inEstimator: true, inGenerator: true, estimator: { enabled: true, baseMin: 1200, baseMax: 9000, unit: "job" } },
  { name: "Stucco Repair", slug: "stucco-repair", category: "Exterior", enabled: true, inEstimator: true, inGenerator: true, estimator: { enabled: true, baseMin: 600, baseMax: 4000, unit: "job" } },
  { name: "Siding Installation", slug: "siding-installation", category: "Exterior", enabled: true, inEstimator: true, inGenerator: true, estimator: { enabled: true, baseMin: 3500, baseMax: 20000, unit: "job" } },
  { name: "Window Replacement", slug: "window-replacement", category: "Doors & Windows", enabled: true, inEstimator: true, inGenerator: true, estimator: { enabled: true, baseMin: 450, baseMax: 2000, unit: "job" } },
  { name: "Door Installation", slug: "door-installation", category: "Doors & Windows", enabled: true, inEstimator: true, inGenerator: true, estimator: { enabled: true, baseMin: 250, baseMax: 1200, unit: "job" } },
  { name: "Driveway Installation", slug: "driveway-installation", category: "Concrete & Masonry", enabled: true, inEstimator: true, inGenerator: true, estimator: { enabled: true, baseMin: 3000, baseMax: 18000, unit: "job" } },
  { name: "Patio Construction", slug: "patio-construction", category: "Outdoor Living", enabled: true, inEstimator: true, inGenerator: true, estimator: { enabled: true, baseMin: 2500, baseMax: 15000, unit: "job" } },
  { name: "Deck Construction", slug: "deck-construction", category: "Outdoor Living", enabled: true, inEstimator: true, inGenerator: true, estimator: { enabled: true, baseMin: 3000, baseMax: 18000, unit: "job" } },
  { name: "Fence Installation", slug: "fence-installation", category: "Outdoor Living", enabled: true, inEstimator: true, inGenerator: true, estimator: { enabled: true, baseMin: 1200, baseMax: 9000, unit: "job" } },
  { name: "Landscaping", slug: "landscaping", category: "Outdoor Living", enabled: true, inEstimator: true, inGenerator: true, estimator: { enabled: true, baseMin: 800, baseMax: 7000, unit: "job" } },
  { name: "General Contractor", slug: "general-contractor", category: "General", enabled: true, inEstimator: true, inGenerator: true, estimator: { enabled: true, baseMin: 1000, baseMax: 10000, unit: "job" } },
  { name: "Permit & Inspections", slug: "permit-inspections", category: "General", enabled: true, inEstimator: true, inGenerator: true, estimator: { enabled: true, baseMin: 300, baseMax: 2000, unit: "job" } },
];

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";

  const db = getAdminDb();
  const refs = SEED_SERVICES.map((svc) => db.collection("services").doc(svc.slug || slugify(svc.name)));
  const snaps = await db.getAll(...refs);

  const batch = db.batch();
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const nowMs = Date.now();

  snaps.forEach((snap, idx) => {
    const exists = snap.exists;
    const svc = SEED_SERVICES[idx];
    const current = exists ? (snap.data() as any) : null;
    const currentEstimator = current?.estimator || {};
    const hasMin = Number.isFinite(Number(currentEstimator.baseMin)) && Number(currentEstimator.baseMin) > 0;
    const hasMax = Number.isFinite(Number(currentEstimator.baseMax)) && Number(currentEstimator.baseMax) > 0;
    const shouldUpdate = force || !hasMin || !hasMax || !exists;
    if (!shouldUpdate) {
      skipped += 1;
      return;
    }

    const tokens = Array.from(
      new Set(
        `${svc.name} ${svc.slug} ${svc.category}`
          .toLowerCase()
          .split(/\s+/)
          .filter(Boolean)
      )
    );
    batch.set(
      refs[idx],
      {
        name: svc.name,
        slug: svc.slug,
        key: svc.slug,
        serviceKey: svc.slug,
        category: svc.category,
        enabled: current?.enabled ?? svc.enabled,
        inEstimator: current?.inEstimator ?? svc.inEstimator,
        inGenerator: current?.inGenerator ?? svc.inGenerator,
        sort: current?.sort ?? idx * 10,
        estimator: force
          ? svc.estimator || { enabled: svc.inEstimator, baseMin: 0, baseMax: 0, unit: "job" }
          : {
              ...currentEstimator,
              ...(svc.estimator || { enabled: svc.inEstimator, baseMin: 0, baseMax: 0, unit: "job" }),
            },
        searchTokens: tokens,
        createdAtMs: current?.createdAtMs ?? nowMs,
        updatedAtMs: nowMs,
      },
      { merge: true }
    );
    if (exists) updated += 1;
    else inserted += 1;
  });

  if (inserted > 0 || updated > 0) {
    await batch.commit();
  }

  return NextResponse.json(
    { ok: true, inserted, updated, skipped, total: SEED_SERVICES.length, force },
    { status: 200 }
  );
}
