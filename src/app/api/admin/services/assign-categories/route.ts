import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin/authz";

const CATEGORY_BY_SLUG: Record<string, string> = {
  "kitchen-remodeling": "Interior",
  "bathroom-remodeling": "Interior",
  "adu-construction": "ADU & Additions",
  "room-addition": "ADU & Additions",
  "garage-conversion": "ADU & Additions",
  "roof-repair": "Roofing",
  "roof-replacement": "Roofing",
  "foundation-repair": "Foundation",
  "seismic-retrofit": "Foundation",
  "concrete-work": "Concrete & Masonry",
  "driveway-installation": "Concrete & Masonry",
  "patio-construction": "Outdoor Living",
  "electrical-panel-upgrade": "Electrical",
  "electrical-rewiring": "Electrical",
  "lighting-installation": "Electrical",
  "plumbing-repair": "Plumbing",
  "plumbing-repiping": "Plumbing",
  "water-heater-installation": "Plumbing",
  "hvac-installation": "HVAC",
  "hvac-repair": "HVAC",
  "flooring-installation": "Flooring & Tile",
  "tile-installation": "Flooring & Tile",
  "drywall-installation-repair": "Drywall",
  "interior-painting": "Painting",
  "exterior-painting": "Painting",
  "stucco-repair": "Exterior",
  "siding-installation": "Exterior",
  "window-replacement": "Doors & Windows",
  "door-installation": "Doors & Windows",
  "deck-construction": "Outdoor Living",
  "landscaping": "Outdoor Living",
  "general-contractor": "General",
  "home-remodeling": "General",
};

export async function POST() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const db = getAdminDb();
  const snap = await db.collection("services").get();
  if (snap.empty) {
    return NextResponse.json({ ok: true, updated: 0 });
  }

  const batch = db.batch();
  let updated = 0;

  snap.docs.forEach((doc) => {
    const data = doc.data() as any;
    const slug = data.slug || data.key || data.serviceKey || doc.id;
    const category = CATEGORY_BY_SLUG[slug] || "General";
    if (data.category === category) return;
    batch.set(doc.ref, { category }, { merge: true });
    updated += 1;
  });

  if (updated) {
    await batch.commit();
  }

  return NextResponse.json({ ok: true, updated });
}
