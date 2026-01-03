import { PriceRange, ServiceKey } from "../pricing/servicePricing";

export type FeedbackConfidence = "too_low" | "accurate" | "too_high";

export type FeedbackStats = {
  service: ServiceKey;
  sample: number;
  tooLow: number;
  tooHigh: number;
  lostForPrice: number;
};

export type TunedRange = PriceRange & { notes?: string[] };

/**
 * Very simple rules engine:
 * - If >20% marked too_low: bump 8–12%
 * - If >20% marked too_high: reduce 8–12%
 * - If lostForPrice high: narrow the spread slightly
 */
export function tuneRange(base: PriceRange, stats: FeedbackStats): TunedRange {
  let low = base.low;
  let typical = base.typical;
  let high = base.high;
  const notes: string[] = base.notes ? [...base.notes] : [];

  const pctTooLow = stats.sample ? stats.tooLow / stats.sample : 0;
  const pctTooHigh = stats.sample ? stats.tooHigh / stats.sample : 0;
  const pctLostPrice = stats.sample ? stats.lostForPrice / stats.sample : 0;

  if (pctTooLow > 0.2) {
    low = Math.round(low * 1.08);
    typical = Math.round(typical * 1.1);
    high = Math.round(high * 1.12);
    notes.push("Adjusted upward based on contractor feedback (too low).");
  }

  if (pctTooHigh > 0.2) {
    low = Math.round(low * 0.92);
    typical = Math.round(typical * 0.9);
    high = Math.round(high * 0.88);
    notes.push("Adjusted downward based on contractor feedback (too high).");
  }

  if (pctLostPrice > 0.15) {
    // narrow the spread to reduce sticker shock
    const mid = (low + high) / 2;
    low = Math.round(mid * 0.9);
    high = Math.round(mid * 1.1);
    typical = Math.round(mid);
    notes.push("Range narrowed due to price-related losses.");
  }

  return { ...base, low, typical, high, notes };
}
