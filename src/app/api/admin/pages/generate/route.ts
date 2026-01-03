import { NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin/authz";
import { rateLimit } from "@/lib/rate-limit";
import { generateSeoPageContent } from "@/lib/generator";
import { slugify } from "@/lib/slug";

type GenerateBody = {
  zipPlaceIds?: string[];
  serviceKeys?: string[];
  countySlug?: string;
  publish?: boolean;
  maxPages?: number;
};

const BATCH_SIZE = 25;

function extractZip(ref: string) {
  const m = String(ref || "").trim().match(/(\d{5})$/);
  return m?.[1] || null;
}

async function resolveZipPlaceRefs(db: FirebaseFirestore.Firestore, ref: string) {
  const refStr = String(ref || "").trim();
  if (!refStr) return [];

  // 1) Direct doc id
  const byId = await db.collection("geo_zip_places").doc(refStr).get();
  if (byId.exists) return [{ id: byId.id, ...(byId.data() as any) }];

  // 2) slug/key fields
  const bySlug = await db.collection("geo_zip_places").where("slug", "==", refStr).limit(1).get();
  if (!bySlug.empty) return bySlug.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

  const byKey = await db.collection("geo_zip_places").where("key", "==", refStr).limit(1).get();
  if (!byKey.empty) return byKey.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

  // 3) ZIP match (return all places for that ZIP)
  const zip = /^\d{5}$/.test(refStr) ? refStr : extractZip(refStr);
  if (zip) {
    const byZip = await db.collection("geo_zip_places").where("zip", "==", zip).get();
    if (!byZip.empty) return byZip.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

    const byZipCode = await db.collection("geo_zip_places").where("zipCode", "==", zip).get();
    if (!byZipCode.empty) return byZipCode.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
  }

  return [];
}

function badRequest(message: string, details?: any) {
  return NextResponse.json(
    { ok: false, code: "invalid_payload", message, details: details ?? null },
    { status: 400 }
  );
}

function serverError(message: string, details?: any) {
  return NextResponse.json(
    { ok: false, code: "server_error", message, details: details ?? null },
    { status: 500 }
  );
}

async function runJob(jobId: string, zipPlaceIds: string[], serviceKeys: string[], publish: boolean) {
  const db = getAdminDb();
  const jobRef = db.collection("generation_jobs").doc(jobId);

  const placeSnap = await db.getAll(...zipPlaceIds.map((id) => db.collection("geo_zip_places").doc(id)));
  const places = placeSnap.filter((d) => d.exists).map((d) => ({ id: d.id, ...(d.data() as any) }));

  const services: Array<{ key: string; label: string; category?: string }> = [];
  if (serviceKeys.length) {
    for (let i = 0; i < serviceKeys.length; i += 10) {
      const chunk = serviceKeys.slice(i, i + 10);
      const snap = await db.getAll(...chunk.map((key) => db.collection("services").doc(key)));
      snap.forEach((d) => {
        if (!d.exists) return;
        const data = d.data() as any;
        services.push({
          key: data.key || data.serviceKey || d.id,
          label: data.name || data.key || data.serviceKey || d.id,
          category: data.category || data.groupKey || null,
        });
      });
    }
  }

  const combos: Array<{ place: any; service: (typeof services)[number] }> = [];
  for (const place of places) {
    for (const service of services) combos.push({ place, service });
  }

  const total = combos.length;
  let completed = 0;
  const started = Date.now();
  let canceled = false;

  try {
    for (let i = 0; i < combos.length; i += BATCH_SIZE) {
      const batchCombos = combos.slice(i, i + BATCH_SIZE);
      const jobSnap = await jobRef.get();
      if (jobSnap.exists && (jobSnap.data() as any)?.canceled) {
        canceled = true;
        break;
      }

      for (const combo of batchCombos) {
        const { place, service } = combo;

        try {
          const placeName = place.placeName || place.name || "Place";
          const placeSlug = place.slug || slugify(placeName);
          const docId = `${place.countySlug}__${place.zip}__${placeSlug}__${service.key}`;
          const pageRef = db.collection("pages").doc(docId);

          const slugPath = `/${place.countySlug || "ca"}/${place.zip}/n/${placeSlug}/${service.key}`;
          const existing = await pageRef.get();
          if (!existing.exists) {
            const generated = generateSeoPageContent(
              { name: placeName, slug: placeSlug },
              { name: service.label, slug: service.key, category: service.category },
              { slugPath }
            );

            const nowTs = Timestamp.now();
            const locationLabel = placeName;
            const locationSubtitle = [place.zip, place.countyName || place.countySlug].filter(Boolean).join(", ");

            const pageData = {
              market: "ca",
              county: { name: place.countyName || null, slug: place.countySlug, countyId: place.countyId || null },
              city: null,
              neighborhood: null,
              zip: place.zip,
              place: { name: placeName, slug: placeSlug, zipPlaceId: place.id },
              placeName,
              placeSlug,
              countyName: place.countyName || null,
              countySlug: place.countySlug,
              locationLabel,
              service: { name: service.label, slug: service.key, key: service.key, category: service.category },
              slugPath,
              status: publish ? ("published" as const) : ("draft" as const),
              seo: generated.seo,
              content: {
                headline: `${service.label} in ${locationLabel}`,
                subheadline: locationSubtitle,
                h1: generated.h1,
                sections: generated.sections,
                faqs: generated.faqs,
                ctas: generated.ctas,
                schemaJsonLd: generated.schemaJsonLd,
              },
              generation: { version: 1, lastGeneratedAt: nowTs, generator: "codex-template-v2" },
              createdAt: nowTs,
              updatedAt: nowTs,
              publishedAt: publish ? nowTs : null,
            };

            await pageRef.set(pageData, { merge: true });
          }

          completed += 1;

          const elapsedSeconds = Math.max(0.001, (Date.now() - started) / 1000);
          const avgSecondsPer = elapsedSeconds / Math.max(completed, 1);
          const etaSeconds = Math.max(0, (total - completed) * avgSecondsPer);

          await jobRef.set(
            {
              completed,
              updatedAt: Timestamp.now(),
              estimatedSecondsRemaining: etaSeconds,
              currentOperation: `${place.countySlug} - ${placeName} - ${service.label}`,
              status: completed >= total ? "done" : "running",
            },
            { merge: true }
          );
        } catch (err: any) {
          await jobRef.set(
            {
              status: "error",
              errorMessage: err?.message || "generation_failed",
              errorStack: err?.stack || null,
              updatedAt: Timestamp.now(),
            },
            { merge: true }
          );
          throw err;
        }
      }
    }

    if (canceled) {
      await jobRef.set(
        { status: "canceled", completed, finishedAt: Timestamp.now(), updatedAt: Timestamp.now() },
        { merge: true }
      );
      return;
    }

    await jobRef.set(
      { status: "done", completed, finishedAt: Timestamp.now(), updatedAt: Timestamp.now(), estimatedSecondsRemaining: 0 },
      { merge: true }
    );
  } catch (err: any) {
    await jobRef.set(
      { status: "error", lastError: err?.message || "generation_failed", updatedAt: Timestamp.now() },
      { merge: true }
    );
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error, status: auth.status }, { status: auth.status });
    }
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = rateLimit(`admin-generate:${ip}`, 6, 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json({ ok: false, error: "rate_limited", resetAt: rl.resetAt }, { status: 429 });
    }

    const raw = (await req.json().catch(() => null)) as any;
    if (!raw || typeof raw !== "object") {
      return badRequest("Request body must be JSON.");
    }
    console.log("[pages/generate] payload keys:", Object.keys(raw || {}));
    console.log("[pages/generate] payload sample:", {
      countySlug: raw?.countySlug,
      serviceKeys: raw?.serviceKeys,
      serviceIds: raw?.serviceIds,
      services: raw?.services,
      placeIds: raw?.placeIds,
      selectedZipPlaceIds: raw?.selectedZipPlaceIds,
    });

    const zipPlaceIdsRaw =
      raw?.zipPlaceIds ||
      raw?.placeIds ||
      raw?.selectedZipPlaceIds ||
      raw?.places ||
      [];
    const zipPlaceIds = Array.isArray(zipPlaceIdsRaw)
      ? Array.from(
          new Set(
            zipPlaceIdsRaw
              .map((x: any) => (typeof x === "string" ? x : x?.id || x?.placeId))
              .filter((x: any) => typeof x === "string" && x.length)
          )
        )
      : [];

    const countySlug =
      typeof raw?.countySlug === "string"
        ? raw.countySlug.trim().toLowerCase()
        : typeof raw?.county === "string"
        ? raw.county.trim().toLowerCase()
        : "";
    const publish = raw?.publish === true;
    const rawMaxPages = Number.isFinite(Number(raw?.maxPages)) ? Number(raw.maxPages) : null;
    const maxPages = rawMaxPages ? Math.max(1, Math.min(1000, rawMaxPages)) : 500;

    const serviceKeysRaw =
      raw?.serviceKeys ||
      raw?.serviceIds ||
      raw?.services ||
      raw?.selectedServices ||
      [];
    const serviceKeys = Array.isArray(serviceKeysRaw)
      ? Array.from(
          new Set(
            serviceKeysRaw
              .map((s: any) =>
                typeof s === "string" ? s : s?.key || s?.serviceKey || s?.id || s?.slug
              )
              .filter((s: any) => typeof s === "string" && s.length)
          )
        )
      : [];

    if (!zipPlaceIds.length) {
      return badRequest("No places selected", { zipPlaceIdsRaw });
    }
    if (!serviceKeys.length) {
      return badRequest("No services selected", { serviceKeysRaw });
    }
    const db = getAdminDb();
    const validServices: Array<{ key: string; name: string; category?: string | null }> = [];
    if (serviceKeys.length) {
      for (let i = 0; i < serviceKeys.length; i += 10) {
        const chunk = serviceKeys.slice(i, i + 10);
        const snap = await db.getAll(...chunk.map((key) => db.collection("services").doc(key)));
        snap.forEach((d) => {
          if (!d.exists) return;
          const data = d.data() as any;
          validServices.push({
            key: data.key || data.slug || data.serviceKey || d.id,
            name: data.name || data.key || data.slug || data.serviceKey || d.id,
            category: data.category || data.groupKey || null,
          });
        });
      }
    }
    if (!validServices.length) {
      return badRequest("Services not found", { serviceKeys });
    }
    const resolvedPlaces: Array<{ id: string; [key: string]: any }> = [];
    const missingRefs: string[] = [];
    for (const ref of zipPlaceIds) {
      const hits = await resolveZipPlaceRefs(db, ref);
      if (!hits.length) {
        missingRefs.push(ref);
        continue;
      }
      hits.forEach((place) => resolvedPlaces.push(place));
    }
    const placeById = new Map<string, any>();
    resolvedPlaces.forEach((place) => placeById.set(place.id, place));
    const validZipPlaceIds = Array.from(placeById.keys());

    if (!validZipPlaceIds.length) {
      return badRequest("Places not found", {
        refs: zipPlaceIds,
        missingRefs,
        collection: "geo_zip_places",
        note: "No docId/slug/key/zip matched geo_zip_places.",
      });
    }

    const jobRef = db.collection("generation_jobs").doc();
    const total = validZipPlaceIds.length * validServices.length;
    const cappedTotal = maxPages ? Math.min(total, maxPages) : total;
    const now = Timestamp.now();

    await jobRef.set({
      status: "running",
      total: cappedTotal,
      completed: 0,
      startedAt: now,
      updatedAt: now,
      selectionSnapshot: {
        countySlug: countySlug || null,
        zipPlaceIds: validZipPlaceIds,
        serviceKeys: validServices.map((s) => s.key),
        maxPages: cappedTotal,
        publish,
      },
      estimatedSecondsRemaining: null,
      currentOperation: null,
    });

    const limitedZipPlaceIds = validZipPlaceIds;
    const limitedServiceKeys = validServices.map((s) => s.key);
    if (maxPages && maxPages < total) {
      const combos: Array<{ zipId: string; svc: string }> = [];
      for (const zipId of limitedZipPlaceIds) {
        for (const svc of limitedServiceKeys) {
          combos.push({ zipId, svc });
        }
      }
      const trimmed = combos.slice(0, maxPages);
      const zipIds = Array.from(new Set(trimmed.map((x) => x.zipId)));
      const svcKeys = Array.from(new Set(trimmed.map((x) => x.svc)));
      runJob(jobRef.id, zipIds, svcKeys, publish);
    } else {
      runJob(jobRef.id, limitedZipPlaceIds, limitedServiceKeys, publish);
    }

    return NextResponse.json({ ok: true, jobId: jobRef.id, total: cappedTotal });
  } catch (err: any) {
    console.error("[pages/generate] error:", err);
    return serverError(err?.message || "unknown", {
      name: err?.name,
      stack: typeof err?.stack === "string" ? err.stack.split("\n").slice(0, 8).join("\n") : null,
    });
  }
}
