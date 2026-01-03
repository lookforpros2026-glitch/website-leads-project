import { NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin/authz";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error, status: auth.status }, { status: auth.status });
  }

  try {
    const { id } = await ctx.params;
    const body = await req.json().catch(() => null);
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    if (!text) {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }

    const db = getAdminDb();
    const leadRef = db.collection("leads").doc(id);
    const leadSnap = await leadRef.get();
    if (!leadSnap.exists) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    const ts = Timestamp.now();
    const noteRef = leadRef.collection("notes").doc();

    await noteRef.set({
      text,
      ts,
      author: auth.email || null,
    });

    return NextResponse.json({
      ok: true,
      note: { id: noteRef.id, tsMs: ts.toMillis(), text, author: auth.email || undefined },
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "server_error", detail: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
