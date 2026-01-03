import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebase-admin";
import { resolveAdminFromDecoded } from "@/lib/admin-authz";

export async function requireAdmin() {
  const session = (await cookies()).get("session")?.value;

  if (!session) {
    return { ok: false as const, status: 401 as const, error: "Missing session cookie" as const };
  }

  try {
    const decoded = await adminAuth.verifySessionCookie(session, true);
    const admin = await resolveAdminFromDecoded(decoded);
    if (!admin) {
      const email = (decoded.email || "").toLowerCase();
      return { ok: false as const, status: 403 as const, error: `Not an admin uid=${decoded.uid} email=${email}` as const };
    }

    return { ok: true as const, uid: admin.uid as string, email: admin.email || "", decoded };
  } catch (e: any) {
    return {
      ok: false as const,
      status: 401 as const,
      error: e?.message || "Invalid/expired session",
    };
  }
}
