import { BASE_PRICES, CITY_MULTIPLIER, ServiceKey } from "./servicePricing";

export type EstimateInputs = {
  service: ServiceKey;
  citySlug?: string;
  propertyType?: "house" | "condo" | "townhome" | "apartment" | "other";
  size?: "small" | "medium" | "large";
  complexity?: "standard" | "complex";
  urgency?: "normal" | "urgent";
  permitLikely?: boolean;
  finish?: "basic" | "standard" | "premium";
};

export type EstimateOutput = {
  low: number;
  typical: number;
  high: number;
  explanation: string[];
};

export function calcEstimate(input: EstimateInputs): EstimateOutput {
  const base = BASE_PRICES[input.service];
  const cityKey = (input.citySlug || "").toLowerCase();
  const multCity = CITY_MULTIPLIER[cityKey] ?? 1.0;

  let m = 1.0;

  if (input.propertyType === "condo" || input.propertyType === "apartment") m *= 1.08;
  if (input.propertyType === "townhome") m *= 1.04;
  if (input.size === "small") m *= 0.85;
  if (input.size === "large") m *= 1.25;
  if (input.complexity === "complex") m *= 1.35;
  if (input.permitLikely) m *= 1.15;
  if (input.finish === "premium") m *= 1.18;
  if (input.finish === "basic") m *= 0.93;
  if (input.urgency === "urgent") m *= 1.2;

  const low = Math.round(base.low * multCity * m);
  const typical = Math.round(base.typical * multCity * m);
  const high = Math.round(base.high * multCity * m);

  const explanation = [
    `Base ${input.service} range adjusted for ${input.citySlug || "market"}.`,
    ...(input.propertyType ? [`Property: ${input.propertyType}`] : []),
    ...(input.size ? [`Size: ${input.size}`] : []),
    ...(input.finish ? [`Finish: ${input.finish}`] : []),
    ...(input.complexity ? [`Complexity: ${input.complexity}`] : []),
    ...(input.permitLikely ? ["Permits likely included."] : []),
    ...(input.urgency ? [`Urgency: ${input.urgency}`] : []),
  ];

  return { low, typical, high, explanation };
}
