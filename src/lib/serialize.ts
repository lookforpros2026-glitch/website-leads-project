import { serializeFirestore } from "./serialize-firestore";

export function serializeFirestoreDoc(doc: { id: string; data: () => any }) {
  return { id: doc.id, ...serializeFirestore(doc.data()) };
}
