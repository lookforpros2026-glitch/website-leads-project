import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/authz";

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status ?? 403 });
  }

  const query = await req.text();
  if (!query || !query.trim()) {
    return NextResponse.json({ ok: false, error: "EMPTY_QUERY" }, { status: 400 });
  }

  const endpoint = "https://overpass-api.de/api/interpreter";

  // Overpass expects x-www-form-urlencoded: data=<QUERY>
  const body = new URLSearchParams({ data: query });

  const r = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body,
  });

  const text = await r.text();
  const contentType = r.headers.get("content-type") || "";

  // Return both raw and parsed (if JSON) to debug fast
  let parsed: any = null;
  if (contentType.includes("application/json")) {
    try {
      parsed = JSON.parse(text);
    } catch {}
  }

  const elementsCount = parsed?.elements?.length ?? null;
  const sample = Array.isArray(parsed?.elements)
    ? parsed.elements.slice(0, 5).map((e: any) => ({
        type: e.type,
        id: e.id,
        tags: e.tags,
        center: e.center,
        lat: e.lat,
        lon: e.lon,
      }))
    : null;

  return NextResponse.json(
    {
      ok: r.ok,
      status: r.status,
      contentType,
      endpoint,
      elementsCount,
      sample,
      rawSnippet: text.slice(0, 800),
      queryHead: query.slice(0, 220),
    },
    { status: r.ok ? 200 : 502 }
  );
}

