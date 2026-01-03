import { NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin/authz";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const db = getAdminDb();
  const snap = await db.collection("config").doc("geo").get();
  const cfg = snap.exists ? (snap.data() as any) : {};
  const locked = cfg.locked !== false;

  return NextResponse.json({ ok: true, locked }, { status: 200 });
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const body = await req.json().catch(() => ({}));
  const locked = body?.locked;

  if (typeof locked !== "boolean") {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  const db = getAdminDb();
  const now = Timestamp.now();
  const payload = locked
    ? { locked: true, lockedAt: now, lockedBy: auth.email || auth.uid || "admin" }
    : { locked: false, unlockedAt: now, unlockedBy: auth.email || auth.uid || "admin" };

  await db.collection("config").doc("geo").set(payload, { merge: true });

  return NextResponse.json({ ok: true, locked });
}
