import { getAdminDb } from "@/lib/firebase-admin";

type AdminAllowlistEntry = {
  uid: string;
  email?: string;
  role?: "owner" | "editor";
  enabled?: boolean;
};

const ALLOWLIST_TTL_MS = 5 * 60 * 1000;

let cachedAllowlist: { entries: AdminAllowlistEntry[]; expiresAt: number } | null = null;
let inflight: Promise<AdminAllowlistEntry[]> | null = null;

function cleanEmail(email?: string) {
  return typeof email === "string" ? email.trim().toLowerCase() : undefined;
}

async function loadAllowlist(): Promise<AdminAllowlistEntry[]> {
  const snap = await getAdminDb().collection("admins").get();
  return snap.docs.map((doc) => ({ uid: doc.id, ...(doc.data() as any) }));
}

async function getAllowlist(): Promise<AdminAllowlistEntry[]> {
  const now = Date.now();
  if (cachedAllowlist && cachedAllowlist.expiresAt > now) return cachedAllowlist.entries;
  if (!inflight) {
    inflight = loadAllowlist().finally(() => {
      inflight = null;
    });
  }
  const entries = await inflight;
  cachedAllowlist = { entries, expiresAt: now + ALLOWLIST_TTL_MS };
  return entries;
}

function matchAllowlist(entry: AdminAllowlistEntry, uid: string, email?: string) {
  if (entry.enabled === false) return false;
  if (entry.uid !== uid) return false;
  if (entry.email && email && cleanEmail(entry.email) !== cleanEmail(email)) return false;
  return true;
}

export function hasAdminClaim(decoded: { [key: string]: any }): boolean {
  return decoded?.admin === true || decoded?.role === "admin" || decoded?.claims?.admin === true;
}

export async function isUidAdmin(uid: string, email?: string): Promise<boolean> {
  const entry = await findAdminEntry(uid, email);
  return Boolean(entry);
}

export async function findAdminEntry(uid: string, email?: string): Promise<AdminAllowlistEntry | null> {
  const cleanUid = (uid || "").trim();
  if (!cleanUid) return null;
  const allowlist = await getAllowlist();
  const match = allowlist.find((entry) => matchAllowlist(entry, cleanUid, email));
  return match || null;
}

export async function resolveAdminFromDecoded(decoded: { [key: string]: any }) {
  const uid = (decoded?.uid || "").trim();
  if (!uid) return null;
  const email = cleanEmail(decoded?.email);

  if (hasAdminClaim(decoded)) {
    return { uid, email, role: "owner" as const };
  }

  const allowlistEntry = await findAdminEntry(uid, email);
  if (!allowlistEntry) return null;

  return {
    uid,
    email: email || cleanEmail(allowlistEntry.email),
    role: (allowlistEntry.role as "owner" | "editor") || "owner",
  };
}
