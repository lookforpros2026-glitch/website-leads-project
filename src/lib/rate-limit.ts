type Bucket = { count: number; resetAt: number };

const globalStore = globalThis as unknown as { __rl?: Map<string, Bucket> };

function store(): Map<string, Bucket> {
  if (!globalStore.__rl) globalStore.__rl = new Map<string, Bucket>();
  return globalStore.__rl;
}

/**
 * Basic fixed-window rate limiter (in-memory; swap to Redis for prod).
 */
export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const s = store();
  const b = s.get(key);

  if (!b || now > b.resetAt) {
    const nb: Bucket = { count: 1, resetAt: now + windowMs };
    s.set(key, nb);
    return { ok: true, remaining: limit - 1, resetAt: nb.resetAt };
  }

  if (b.count >= limit) {
    return { ok: false, remaining: 0, resetAt: b.resetAt };
  }

  b.count += 1;
  s.set(key, b);
  return { ok: true, remaining: limit - b.count, resetAt: b.resetAt };
}
