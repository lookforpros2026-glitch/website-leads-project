import { NextResponse } from "next/server";

export function apiOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, ...data }, init);
}

export function apiError(code: string, status: number, detail?: string) {
  const safeDetail = process.env.NODE_ENV === "development" ? detail : undefined;
  return NextResponse.json(
    { ok: false, error: code, ...(safeDetail ? { detail: safeDetail } : {}) },
    { status }
  );
}
