type EstimateOptions = {
  serviceSlug?: string;
  size?: "small" | "medium" | "large";
  finish?: "basic" | "standard" | "premium";
  urgency?: "asap" | "soon" | "flexible";
  city?: string;
};

type Range = { min: number; max: number };

const baseRanges: Record<string, Range> = {
  "kitchen-remodeling": { min: 12000, max: 40000 },
  "bathroom-remodeling": { min: 8000, max: 25000 },
  "roof-repair": { min: 600, max: 5000 },
  "plumbing-repair": { min: 250, max: 1500 },
  "electrical-services": { min: 300, max: 2500 },
  "adu-construction": { min: 75000, max: 180000 },
};

const cityMultipliers: Record<string, number> = {
  "los angeles": 1.12,
  "santa monica": 1.15,
  "pasadena": 1.08,
  "long beach": 1.05,
  "glendale": 1.06,
};

function multipliers(opts: EstimateOptions) {
  const sizeMult =
    opts.size === "small" ? 0.85 : opts.size === "large" ? 1.25 : 1.0;
  const finishMult =
    opts.finish === "basic" ? 0.9 : opts.finish === "premium" ? 1.25 : 1.0;
  const urgencyMult = opts.urgency === "asap" ? 1.1 : 1.0;
  const cityKey = (opts.city || "").toLowerCase().trim();
  const cityMult = cityKey && cityKey in cityMultipliers ? cityMultipliers[cityKey] : 1.0;
  return sizeMult * finishMult * urgencyMult * cityMult;
}

function round(val: number) {
  // Round to nearest $50 for small amounts, $100 for larger
  if (val < 1000) return Math.round(val / 50) * 50;
  return Math.round(val / 100) * 100;
}

export function estimateRange(opts: EstimateOptions): Range {
  const slug = (opts.serviceSlug || "").toLowerCase().trim();
  const base = baseRanges[slug] ?? { min: 500, max: 2000 };
  const mult = multipliers(opts);
  return {
    min: round(base.min * mult),
    max: round(base.max * mult),
  };
}
