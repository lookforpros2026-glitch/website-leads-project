export type ServiceKey =
  | "kitchen-remodeling"
  | "bathroom-remodeling"
  | "plumbing-repair"
  | "electrical-services"
  | "hvac-repair"
  | "roof-repair"
  | "painting"
  | "flooring"
  | "window-installation"
  | "drywall"
  | "landscaping"
  | "general-contractor";

export type PriceRange = {
  low: number;
  typical: number;
  high: number;
  unit?: "job" | "sqft" | "fixture" | "linear_ft";
  notes?: string[];
};

export const BASE_PRICES: Record<ServiceKey, PriceRange> = {
  "kitchen-remodeling": {
    low: 18000,
    typical: 45000,
    high: 95000,
    unit: "job",
    notes: ["Depends heavily on cabinets, layout changes, and appliances."],
  },
  "bathroom-remodeling": { low: 9000, typical: 22000, high: 45000, unit: "job" },
  "plumbing-repair": { low: 150, typical: 450, high: 1600, unit: "job" },
  "electrical-services": { low: 250, typical: 850, high: 3500, unit: "job" },
  "hvac-repair": { low: 180, typical: 650, high: 2500, unit: "job" },
  "roof-repair": { low: 400, typical: 1800, high: 8500, unit: "job" },
  painting: { low: 1200, typical: 4200, high: 12000, unit: "job" },
  flooring: { low: 2500, typical: 7000, high: 18000, unit: "job" },
  "window-installation": { low: 900, typical: 2800, high: 9000, unit: "job" },
  drywall: { low: 300, typical: 1200, high: 4500, unit: "job" },
  landscaping: { low: 1200, typical: 5500, high: 25000, unit: "job" },
  "general-contractor": { low: 1500, typical: 6500, high: 40000, unit: "job" },
};

export const CITY_MULTIPLIER: Record<string, number> = {
  "los-angeles": 1.0,
  "pasadena": 1.05,
  "santa-monica": 1.15,
  "beverly-hills": 1.2,
};
