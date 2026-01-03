import { EstimatorConfig } from "./types";

type EstimateInputs = {
  serviceKey: string;
  zip?: string;
  urgency?: "low" | "normal" | "high";
  complexity?: "basic" | "standard" | "premium";
};

export function calcEstimate(config: EstimatorConfig, answers: EstimateInputs) {
  const service = config.services.find((s) => s.key === answers.serviceKey);
  if (!service) {
    return { min: 0, max: 0, breakdown: [], service: null };
  }

  const urgency = answers.urgency || "normal";
  const complexity = answers.complexity || "standard";
  const zipMultiplier = answers.zip ? config.modifiers.zipMultipliers[answers.zip] || 1 : 1;

  const baseMin = service.baseMin;
  const baseMax = service.baseMax;

  const laborMult = config.pricing.laborMultiplier || 1;
  const materialMult = config.pricing.materialMultiplier || 1;
  const urgencyMult = config.modifiers.urgency[urgency] || 1;
  const complexityMult = config.modifiers.complexity[complexity] || 1;

  const multiplier = laborMult * materialMult * urgencyMult * complexityMult * zipMultiplier;

  let min = Math.round(baseMin * multiplier);
  let max = Math.round(baseMax * multiplier);

  if (config.pricing.minJob) {
    min = Math.max(min, config.pricing.minJob);
    max = Math.max(max, config.pricing.minJob);
  }
  if (config.pricing.maxJob) {
    min = Math.min(min, config.pricing.maxJob);
    max = Math.min(max, config.pricing.maxJob);
  }

  return {
    min,
    max,
    service,
    breakdown: [
      { label: "Base", value: `${baseMin} - ${baseMax}` },
      { label: "Labor", value: laborMult },
      { label: "Materials", value: materialMult },
      { label: "Urgency", value: urgencyMult },
      { label: "Complexity", value: complexityMult },
      { label: "ZIP", value: zipMultiplier },
    ],
  };
}
