import type { NextApiRequest } from "next";
import { getAdminAuth } from "./firebase-admin";
import { resolveAdminFromDecoded } from "./admin-authz";

function readCookie(req: NextApiRequest, name: string) {
  const raw = req.headers.cookie || "";
  const parts = raw.split(";").map((s) => s.trim());
  for (const part of parts) {
    if (part.startsWith(name + "=")) {
      return decodeURIComponent(part.slice(name.length + 1));
    }
  }
  return "";
}

export async function getAdminFromPagesReq(req: NextApiRequest) {
  const token = readCookie(req, "sylor_session") || readCookie(req, "session") || "";
  if (!token) return null;
  const decoded = await getAdminAuth().verifySessionCookie(token, true).catch(() => null);
  if (!decoded) return null;
  return resolveAdminFromDecoded(decoded);
}
