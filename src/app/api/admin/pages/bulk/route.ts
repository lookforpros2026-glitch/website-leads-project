import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { PagesBulkRequestSchema } from "@/lib/validators/pages-bulk";
import { requireAdmin } from "@/lib/admin/authz";

function getThreshold() {
  const raw = process.env.QA_PUBLISH_THRESHOLD;
  const n = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(n) ? n : 70;
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error, status: auth.status }, { status: auth.status });
    }
    const body = await req.json().catch(() => null);
    const parsed = PagesBulkRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }
    const { action, pageIds, force } = parsed.data;
    const db = getAdminDb();
    const now = Timestamp.now();
    const threshold = getThreshold();
    const chunkSize = 200;
    let updatedCount = 0;
    let skippedCount = 0;

    if (action === "qa") {
      for (let i = 0; i < pageIds.length; i += chunkSize) {
        const chunk = pageIds.slice(i, i + chunkSize);
        const snaps = await Promise.all(chunk.map((id) => db.collection("pages").doc(id).get()));
        const batch = db.batch();
        for (const s of snaps) {
          if (!s.exists) continue;
          const d = s.data() as any;
          const issues: string[] = [];
          if (!d.slug) issues.push("missing_slug");
          if (!d.city) issues.push("missing_city");
          if (!d.service) issues.push("missing_service");
          if (!d.seo?.title) issues.push("missing_seo_title");
          if (!d.seo?.description) issues.push("missing_seo_description");
          const score = Math.max(0, 100 - issues.length * 15);
          batch.update(s.ref, {
            qaScore: score,
            qaIssues: issues,
            lastQaAt: now,
            updatedAt: now,
          });
          updatedCount += 1;
        }
        await batch.commit();
      }
      return NextResponse.json({ ok: true, updatedCount, skippedCount });
    }

    const publish = action === "publish";
    for (let i = 0; i < pageIds.length; i += chunkSize) {
      const chunk = pageIds.slice(i, i + chunkSize);
      const snaps = await Promise.all(chunk.map((id) => db.collection("pages").doc(id).get()));
      const batch = db.batch();
      for (const s of snaps) {
        if (!s.exists) continue;
        if (publish) {
          const d = s.data() as any;
          const qaScore = typeof d.qaScore === "number" ? d.qaScore : null;
          const allowed = force || (qaScore !== null && qaScore >= threshold);
          if (!allowed) {
            skippedCount += 1;
            continue;
          }
        }
        batch.update(s.ref, {
          status: publish ? "published" : "draft",
          publishedAt: publish ? now : null,
          updatedAt: now,
        });
        updatedCount += 1;
      }
      await batch.commit();
    }

    return NextResponse.json({ ok: true, updatedCount, skippedCount });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "server_error", detail: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
