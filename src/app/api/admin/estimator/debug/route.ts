import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/authz";
import { getAdminDb } from "@/lib/firebase-admin";
import { serializeFirestore } from "@/lib/serialize-firestore";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const db = getAdminDb();
  const [draftSnap, publishedSnap] = await Promise.all([
    db.collection("estimator_config").doc("draft").get(),
    db.collection("estimator_config").doc("published").get(),
  ]);

  const draft = draftSnap.exists ? serializeFirestore(draftSnap.data() as any) : null;
  const published = publishedSnap.exists ? serializeFirestore(publishedSnap.data() as any) : null;

  const firstDraft = Array.isArray(draft?.services) ? draft.services[0] : null;
  const firstPublished = Array.isArray(published?.services) ? published.services[0] : null;

  return NextResponse.json({
    ok: true,
    draft: {
      version: draft?.version ?? null,
      updatedAt: draft?.updatedAt ?? null,
      firstService: firstDraft ? { key: firstDraft.key, baseMin: firstDraft.baseMin, baseMax: firstDraft.baseMax } : null,
    },
    published: {
      version: published?.version ?? null,
      publishedAt: published?.publishedAt ?? null,
      firstService: firstPublished
        ? { key: firstPublished.key, baseMin: firstPublished.baseMin, baseMax: firstPublished.baseMax }
        : null,
    },
  });
}
