import { NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin/authz";

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const url = new URL(req.url);
  const jobId = url.searchParams.get("jobId");
  if (!jobId) {
    return NextResponse.json({ ok: false, error: "MISSING_JOB_ID" }, { status: 400 });
  }

  const db = getAdminDb();
  await db.collection("generation_jobs").doc(jobId).set(
    {
      canceled: true,
      status: "canceled",
      updatedAt: Timestamp.now(),
    },
    { merge: true }
  );

  return NextResponse.json({ ok: true, jobId }, { status: 200 });
}

