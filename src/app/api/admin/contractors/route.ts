import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin/authz";

type Contractor = { id: string; name: string; email?: string | null; active?: boolean };

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error, status: auth.status }, { status: auth.status });
  }

  try {
    const url = new URL(req.url);
    const activeOnly = url.searchParams.get("active") === "true";

    const db = getAdminDb();
    let q: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = db.collection("contractors");
    if (activeOnly) {
      q = q.where("active", "==", true);
    }

    const snap = await q.get();
    const contractors: Contractor[] = snap.docs.map((doc) => {
      const data = doc.data() as any;
      return {
        id: doc.id,
        name: data.name || "Unnamed contractor",
        email: data.email ?? null,
        active: data.active ?? true,
      };
    });

    contractors.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ ok: true, contractors });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "server_error", detail: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
