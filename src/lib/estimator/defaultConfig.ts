import { EstimatorConfig } from "./types";

export function buildDefaultEstimatorConfig(status: "draft" | "published" = "draft"): EstimatorConfig {
  return {
    version: 1,
    status,
    currency: "USD",
    services: [],
    pricing: {
      laborMultiplier: 1,
      materialMultiplier: 1,
      minJob: 150,
      maxJob: 250000,
    },
    modifiers: {
      urgency: { low: 0.9, normal: 1.0, high: 1.2 },
      complexity: { basic: 0.95, standard: 1.0, premium: 1.15 },
      zipMultipliers: {},
    },
    steps: [
      { id: "service", type: "service", title: "Choose a service", required: true },
      { id: "details", type: "details", title: "Project details", required: true },
      { id: "urgency", type: "urgency", title: "Timing", required: true },
      { id: "contact", type: "contact", title: "Contact", required: true },
    ],
  };
}
