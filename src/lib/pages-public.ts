import { adminDb } from "@/lib/firebase-admin";

export async function getPageBySlug(slug: string) {
  const slugLower = (slug || "").trim().toLowerCase();
  if (!slugLower) return null;

  const snap = await adminDb
    .collection("pages")
    .where("slugLower", "==", slugLower)
    .limit(1)
    .get();

  if (snap.empty) return null;

  const doc = snap.docs[0];
  const d = doc.data() as any;

  return {
    id: doc.id,
    ...d,
    createdAt: d.createdAt?.toMillis?.() ?? null,
    updatedAt: d.updatedAt?.toMillis?.() ?? null,
  };
}
