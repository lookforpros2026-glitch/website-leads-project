export type EstimatorService = {
  key: string;
  name: string;
  category: string;
  enabled: boolean;
  sort: number;
  baseMin: number;
  baseMax: number;
  durationMinDays?: number;
  durationMaxDays?: number;
  unit?: "job" | "sqft" | "linear_ft";
  notes?: string;
};

export type EstimatorConfig = {
  version: number;
  status: "draft" | "published";
  updatedAt?: any;
  publishedAt?: any;
  currency: "USD";
  services: EstimatorService[];
  pricing: {
    laborMultiplier: number;
    materialMultiplier: number;
    minJob: number;
    maxJob?: number;
  };
  modifiers: {
    urgency: { low: number; normal: number; high: number };
    complexity: { basic: number; standard: number; premium: number };
    zipMultipliers: Record<string, number>;
  };
  steps: Array<{
    id: string;
    type: "service" | "details" | "urgency" | "contact";
    title: string;
    required: boolean;
    options?: Array<{ key: string; label: string; multiplier?: number }>;
  }>;
};
