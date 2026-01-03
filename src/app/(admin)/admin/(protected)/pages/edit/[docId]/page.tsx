import { getAdminDb } from "@/lib/firebase-admin";
import { serializeFirestore } from "@/lib/serialize-firestore";
import PageEditorClient from "./PageEditorClient";

type Params = { docId: string };

export default async function EditPage({ params }: { params: Promise<Params> }) {
  const { docId } = await params;
  const db = getAdminDb();
  const snap = await db.collection("pages").doc(docId).get();

  if (!snap.exists) {
    return <div className="p-6 text-slate-200">Page not found.</div>;
  }

  const data = serializeFirestore(snap.data() || {});

  return <PageEditorClient docId={docId} initial={data as any} />;
}
