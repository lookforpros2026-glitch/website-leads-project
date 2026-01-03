import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin/authz";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error, status: auth.status }, { status: auth.status });
  }

  const url = new URL(req.url);
  const jobId = url.searchParams.get("jobId");
  if (!jobId) {
    return NextResponse.json({ ok: false, error: "missing_job_id" }, { status: 400 });
  }

  const snap = await getAdminDb().collection("page_health_jobs").doc(jobId).get();
  if (!snap.exists) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  const data = snap.data() as any;
  return NextResponse.json({
    ok: true,
    id: snap.id,
    status: data?.status || "unknown",
    progress: data?.progress || { done: 0, total: 0, percent: 0 },
    output: data?.output || null,
    updatedAt: data?.updatedAt || null,
    createdAt: data?.createdAt || null,
  });
}
