import { Timestamp } from "firebase-admin/firestore";
import { buildDefaultEstimatorConfig } from "./defaultConfig";

export async function ensureEstimatorConfig(db: FirebaseFirestore.Firestore) {
  const draftRef = db.collection("estimator_config").doc("draft");
  const publishedRef = db.collection("estimator_config").doc("published");

  const [draftSnap, publishedSnap] = await Promise.all([draftRef.get(), publishedRef.get()]);

  if (!draftSnap.exists) {
    const draft = buildDefaultEstimatorConfig("draft");
    await draftRef.set({ ...draft, updatedAt: Timestamp.now() }, { merge: true });
  }

  if (!publishedSnap.exists) {
    const published = buildDefaultEstimatorConfig("published");
    await publishedRef.set({ ...published, updatedAt: Timestamp.now(), publishedAt: Timestamp.now() }, { merge: true });
  }
}
