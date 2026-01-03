import { cookies } from "next/headers";
import { adminAuth } from "./firebase-admin";
import { resolveAdminFromDecoded } from "./admin-authz";

export const SESSION_COOKIE_NAME = "session";

export type SessionAdmin = { uid: string; email?: string; role: "owner" | "editor" };

export async function getAdminFromAppCookies(): Promise<SessionAdmin | null> {
  const cookieStore = await cookies();
  const session =
    cookieStore.get(SESSION_COOKIE_NAME)?.value ||
    cookieStore.get("sylor_session")?.value ||
    "";
  if (!session) return null;
  try {
    const decoded = await adminAuth.verifySessionCookie(session, true);
    const admin = await resolveAdminFromDecoded(decoded);
    if (!admin) return null;
    return admin;
  } catch {
    return null;
  }
}

export async function getSessionAdmin(): Promise<SessionAdmin | null> {
  return getAdminFromAppCookies();
}

export async function requireAdmin(): Promise<SessionAdmin> {
  const admin = await getAdminFromAppCookies();
  if (!admin) {
    throw new Error("UNAUTHORIZED");
  }
  return admin;
}

export async function requireAdminFromAppCookies() {
  const admin = await getAdminFromAppCookies();
  if (!admin) {
    return { admin: null, status: 401 as const };
  }
  return { admin, status: 200 as const };
}

export function logoutAdminCookie() {
  const secure = process.env.NODE_ENV === "production";
  cookies().then((store) => {
    store.set(SESSION_COOKIE_NAME, "", { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 0 });
  });
}
