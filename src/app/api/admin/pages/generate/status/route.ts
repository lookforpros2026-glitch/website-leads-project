import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/authz";
import { getAdminDb } from "@/lib/firebase-admin";

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error, status: auth.status }, { status: auth.status });
  }

  const url = new URL(req.url);
  const jobId = url.searchParams.get("jobId");
  if (!jobId) return NextResponse.json({ ok: false, error: "missing_jobId" }, { status: 400 });

  const db = getAdminDb();
  const snap = await db.collection("generation_jobs").doc(jobId).get();
  if (!snap.exists) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  const data = snap.data() as any;

  const startedMs = data.startedAt?.toMillis?.() || null;
  const updatedMs = data.updatedAt?.toMillis?.() || null;
  const finishedMs = data.finishedAt?.toMillis?.() || null;
  const completed = data.completed ?? 0;
  const total = data.total ?? 0;
  const elapsedSeconds = startedMs ? (Date.now() - startedMs) / 1000 : null;
  const etaSeconds =
    typeof data.estimatedSecondsRemaining === "number"
      ? data.estimatedSecondsRemaining
      : completed && total && elapsedSeconds
      ? Math.max(0, ((total - completed) * elapsedSeconds) / Math.max(completed, 1))
      : null;

  return NextResponse.json({
    ok: true,
    jobId,
    status: data.status,
    total,
    completed,
    startedAtMs: startedMs,
    updatedAtMs: updatedMs,
    finishedAtMs: finishedMs,
    etaSeconds,
    elapsedSeconds,
    error: data.lastError || data.error || data.errorMessage || null,
    errorMessage: data.errorMessage || null,
    errorStack: data.errorStack || null,
    canceled: Boolean(data.canceled),
    currentOperation: data.currentOperation || null,
  });
}
