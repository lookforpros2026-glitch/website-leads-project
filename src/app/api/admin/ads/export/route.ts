import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin/authz";
import { getSiteSettings } from "@/lib/settings";
import { resolveBaseUrl } from "@/lib/env";
import { buildCanonicalPath } from "@/lib/page-paths";

function csvEscape(value: string) {
  if (value.includes(",") || value.includes("\"") || value.includes("\n")) {
    return `"${value.replace(/\"/g, "\"\"")}"`;
  }
  return value;
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error, status: auth.status }, { status: auth.status });
  }

  const body = (await req.json().catch(() => null)) as any;
  const serviceKeys = Array.isArray(body?.serviceKeys) ? body.serviceKeys.map(String) : [];
  const countySlugs = Array.isArray(body?.countySlugs) ? body.countySlugs.map(String) : [];
  const zip = typeof body?.zip === "string" ? body.zip : "";
  const limit = Math.min(2000, Math.max(1, Number(body?.limit || 500)));

  const settings = await getSiteSettings();
  const hdrs = await headers();
  const base = resolveBaseUrl(hdrs, settings.seo.canonicalMode === "siteUrl" ? settings.siteUrl : undefined);

  let query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = getAdminDb()
    .collection("pages")
    .where("status", "==", "published")
    .orderBy("updatedAt", "desc")
    .limit(limit);

  if (zip) {
    query = query.where("zip", "==", zip);
  }

  const snap = await query.get();
  const rows = snap.docs
    .map((d) => d.data() as any)
    .filter((p) => {
      if (serviceKeys.length) {
        const key = p.service?.key || p.serviceKey || p.service?.slug || "";
        if (!serviceKeys.includes(String(key))) return false;
      }
      if (countySlugs.length) {
        const slug = p.countySlug || p.county?.slug || "";
        if (!countySlugs.includes(String(slug))) return false;
      }
      return true;
    })
    .map((p) => {
      const url = `${base}${buildCanonicalPath(p) || p.slugPath || ""}`;
      return {
        finalUrl: url,
        serviceKey: p.service?.key || p.serviceKey || "",
        countySlug: p.countySlug || p.county?.slug || "",
        citySlug: p.citySlug || p.city?.slug || "",
        zip: p.zip || "",
      };
    });

  const header = ["final_url", "service_key", "county_slug", "city_slug", "zip"];
  const csv = [
    header.join(","),
    ...rows.map((r) =>
      [r.finalUrl, r.serviceKey, r.countySlug, r.citySlug, r.zip].map((v) => csvEscape(String(v || ""))).join(",")
    ),
  ].join("\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": "attachment; filename=ads-export.csv",
    },
  });
}
