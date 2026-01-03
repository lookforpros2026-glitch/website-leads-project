import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin/authz";

type SeoPatch = {
  title?: string;
  description?: string;
  h1?: string;
  canonical?: string;
  index?: boolean;
};

function pickAllowedSeo(seo: any): SeoPatch | null {
  if (!seo || typeof seo !== "object") return null;
  const allowed: SeoPatch = {};
  if (typeof seo.title === "string") allowed.title = seo.title;
  if (typeof seo.description === "string") allowed.description = seo.description;
  if (typeof seo.h1 === "string") allowed.h1 = seo.h1;
  if (typeof seo.canonical === "string") allowed.canonical = seo.canonical;
  if (typeof seo.index === "boolean") allowed.index = seo.index;
  return Object.keys(allowed).length ? allowed : null;
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const body = await req.json().catch(() => ({}));
  const docId = typeof body?.docId === "string" ? body.docId.trim() : "";
  if (!docId) {
    return NextResponse.json({ ok: false, error: "MISSING_DOC_ID" }, { status: 400 });
  }

  const patch = body?.patch || {};
  const safePatch: Record<string, any> = {};

  if (typeof patch.status === "string") {
    const status = patch.status;
    if (status === "published" || status === "unpublished" || status === "draft") {
      safePatch.status = status;
    }
  }

  const safeSeo = pickAllowedSeo(patch.seo);
  if (safeSeo) safePatch.seo = safeSeo;

  if (!Object.keys(safePatch).length) {
    return NextResponse.json({ ok: false, error: "EMPTY_PATCH" }, { status: 400 });
  }

  const db = getAdminDb();
  const ref = db.collection("pages").doc(docId);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  await ref.set(
    {
      ...safePatch,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return NextResponse.json({ ok: true }, { status: 200 });
}
