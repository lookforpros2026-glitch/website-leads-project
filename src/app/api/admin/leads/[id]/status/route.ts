import { NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin/authz";
import { LeadStatusPatchSchema } from "@/lib/validators/lead-admin";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error, status: auth.status }, { status: auth.status });
  }

  try {
    const { id } = await ctx.params;
    const body = await req.json().catch(() => null);
    const parsed = LeadStatusPatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }

    const db = getAdminDb();
    const ref = db.collection("leads").doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    const now = Timestamp.now();
    await ref.update({
      status: parsed.data.status,
      updatedAt: now,
      statusUpdatedAt: now,
    });

    const ms = now.toMillis();
    return NextResponse.json({ ok: true, status: parsed.data.status, updatedAtMs: ms, statusUpdatedAtMs: ms });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "server_error", detail: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
