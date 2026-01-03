import { canUseAdmin, getAdminDb } from "@/lib/firebase-admin";
import { getPublicDb } from "@/lib/firestore-public";
import { doc, getDoc } from "firebase/firestore";
import { serializeFirestore } from "@/lib/serialize-firestore";
import { buildDefaultTemplateDoc } from "@/templates/defaultTemplate";
import { ensureDefaultTemplate } from "./ensureTemplate";

export async function fetchPublishedTemplate() {
  if (canUseAdmin()) {
    const db = getAdminDb();
    const data = await ensureDefaultTemplate(db);
    return data.published || data.draft;
  }

  const publicDb = getPublicDb();
  const snap = await getDoc(doc(publicDb, "templates", "default"));
  if (!snap.exists()) {
    return buildDefaultTemplateDoc().published;
  }
  const data = serializeFirestore(snap.data() as any) as any;
  return data.published || data.draft;
}
