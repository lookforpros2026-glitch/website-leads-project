import { getAdminDb } from "./firebase-admin";

export type Quality = {
  wordCount: number;
  duplicationScore: number;
  requiredSectionsOk: boolean;
  lastQaAt?: Date;
  warnings: string[];
};

const REQUIRED_SECTION_IDS = [
  "overview",
  "what_includes",
  "local_considerations",
  "cost",
  "timeline",
  "permits",
  "how_to_choose",
  "our_process",
];

function tokenize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function getShingles(words: string[], size = 5): Set<string> {
  const shingles = new Set<string>();
  for (let i = 0; i < words.length - size + 1; i++) {
    shingles.add(words.slice(i, i + size).join(" "));
  }
  return shingles;
}

function jaccard(a: Set<string>, b: Set<string>) {
  const intersection = new Set([...a].filter((x) => b.has(x)));
  const union = new Set([...a, ...b]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

function buildBodyText(page: any) {
  return [
    page?.content?.h1 ?? "",
    ...(page?.content?.sections || []).map((s: any) => `${s.title} ${s.body} ${(s.bullets || []).join(" ")}`),
    ...(page?.content?.faqs || []).map((f: any) => `${f.q} ${f.a}`),
  ].join(" ");
}

export function evaluateQuality(page: any, peersSameService: any[]) {
  const bodyText = buildBodyText(page);
  const wordCount = tokenize(bodyText).length;
  const requiredSectionsOk = REQUIRED_SECTION_IDS.every((id) => (page?.content?.sections || []).some((s: any) => s.id === id));
  const metaLength = (page?.seo?.description || "").length;
  const metaWarn = metaLength < 140 || metaLength > 170;

  const currentShingles = getShingles(tokenize(bodyText));
  let duplicationScore = 0;
  peersSameService.forEach((peer) => {
    const text = buildBodyText(peer);
    const sim = jaccard(currentShingles, getShingles(tokenize(text)));
    duplicationScore = Math.max(duplicationScore, sim);
  });

  const warnings: string[] = [];
  if (!requiredSectionsOk) warnings.push("Missing required sections");
  if (wordCount < 900) warnings.push("Word count below 900");
  if (metaWarn) warnings.push("Meta description outside 140-170 chars");
  if (duplicationScore > 0.55) warnings.push("Duplication score high vs peers");

  const pass = wordCount >= 900 && requiredSectionsOk && duplicationScore <= 0.65;
  const quality: Quality = {
    wordCount,
    duplicationScore,
    requiredSectionsOk,
    lastQaAt: new Date(),
    warnings,
  };
  return { quality, pass };
}

export async function runQa(pageId: string) {
  const db = getAdminDb();
  const docRef = db.collection("pages").doc(pageId);
  const snap = await docRef.get();
  if (!snap.exists) throw new Error("Page not found");
  const page = snap.data() as any;

  const peerSnap = await db
    .collection("pages")
    .where("service.slug", "==", page?.service?.slug)
    .get();
  const peers = peerSnap.docs
    .filter((d) => d.id !== pageId)
    .map((d) => d.data() as any);

  const { quality, pass } = evaluateQuality(page, peers);

  await docRef.update({
    quality,
    status: pass ? "review" : page.status,
    updatedAt: new Date(),
  });

  return { quality, pass };
}
