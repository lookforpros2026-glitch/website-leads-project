import { Timestamp } from "firebase-admin/firestore";
import { buildDefaultTemplateDoc } from "@/templates/defaultTemplate";

export async function ensureDefaultTemplate(db: FirebaseFirestore.Firestore) {
  const ref = db.collection("templates").doc("default");
  const snap = await ref.get();
  if (snap.exists) return snap.data() as any;

  const now = Timestamp.now();
  const doc = buildDefaultTemplateDoc();
  await ref.set({ ...doc, updatedAt: now, publishedAt: now }, { merge: true });
  return doc;
}
