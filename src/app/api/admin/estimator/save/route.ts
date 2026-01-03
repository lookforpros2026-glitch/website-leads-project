import { NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { requireAdmin } from "@/lib/admin/authz";
import { getAdminDb } from "@/lib/firebase-admin";
import { ensureEstimatorConfig } from "@/lib/estimator/ensureConfig";
import { EstimatorConfig } from "@/lib/estimator/types";

function sanitizeConfig(input: any): EstimatorConfig | null {
  if (!input || typeof input !== "object") return null;
  const steps = Array.isArray(input.steps) ? input.steps : [];

  return {
    version: Number(input.version || 1),
    status: "draft",
    currency: "USD",
    services: [],
    pricing: {
      laborMultiplier: Number(input.pricing?.laborMultiplier || 1),
      materialMultiplier: Number(input.pricing?.materialMultiplier || 1),
      minJob: Number(input.pricing?.minJob || 0),
      maxJob: input.pricing?.maxJob != null ? Number(input.pricing?.maxJob) : undefined,
    },
    modifiers: {
      urgency: {
        low: Number(input.modifiers?.urgency?.low || 1),
        normal: Number(input.modifiers?.urgency?.normal || 1),
        high: Number(input.modifiers?.urgency?.high || 1),
      },
      complexity: {
        basic: Number(input.modifiers?.complexity?.basic || 1),
        standard: Number(input.modifiers?.complexity?.standard || 1),
        premium: Number(input.modifiers?.complexity?.premium || 1),
      },
      zipMultipliers: input.modifiers?.zipMultipliers || {},
    },
    steps: steps.map((step: any) => ({
      id: String(step.id || ""),
      type: step.type,
      title: String(step.title || ""),
      required: Boolean(step.required),
      options: Array.isArray(step.options)
        ? step.options.map((opt: any) => ({
            key: String(opt.key || ""),
            label: String(opt.label || ""),
            multiplier: opt.multiplier != null ? Number(opt.multiplier) : undefined,
          }))
        : undefined,
    })),
  };
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const body = await req.json().catch(() => ({}));
  const draft = sanitizeConfig(body?.draft);
  if (!draft) {
    return NextResponse.json({ ok: false, error: "INVALID_CONFIG" }, { status: 400 });
  }

  const db = getAdminDb();
  await ensureEstimatorConfig(db);

  const now = Timestamp.now();
  await db.collection("estimator_config").doc("draft").set(
    {
      ...draft,
      status: "draft",
      updatedAt: now,
    },
    { merge: true }
  );

  return NextResponse.json({ ok: true }, { status: 200 });
}
