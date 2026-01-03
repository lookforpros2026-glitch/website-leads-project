import { NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { requireAdmin } from "@/lib/admin/authz";
import { getAdminDb } from "@/lib/firebase-admin";
import { ensureDefaultTemplate } from "@/lib/templates/ensureTemplate";

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const body = await req.json().catch(() => ({}));
  const templateId = String(body?.templateId || "default").trim();
  if (templateId !== "default") {
    return NextResponse.json({ ok: false, error: "INVALID_TEMPLATE" }, { status: 400 });
  }

  const db = getAdminDb();
  const existing = await ensureDefaultTemplate(db);
  const draft = existing?.draft;
  if (!draft) {
    return NextResponse.json({ ok: false, error: "MISSING_DRAFT" }, { status: 400 });
  }

  const publishedVersion = existing?.draftVersion || 1;

  await db
    .collection("templates")
    .doc("default")
    .set(
      {
        published: draft,
        publishedVersion,
        status: "published",
        publishedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      },
      { merge: true }
    );

  return NextResponse.json({ ok: true, publishedVersion }, { status: 200 });
}
