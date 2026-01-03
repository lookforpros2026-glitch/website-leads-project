function isTimestamp(v: any) {
  return v && typeof v === "object" && typeof v.toMillis === "function";
}

export function serializeFirestore(input: any): any {
  if (input === null || input === undefined) return input;

  if (isTimestamp(input)) return input.toMillis();

  if (Array.isArray(input)) return input.map(serializeFirestore);

  if (typeof input === "object") {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(input)) out[k] = serializeFirestore(v);
    return out;
  }

  return input;
}
