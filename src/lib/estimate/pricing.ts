export const SERVICE_PRICING = {
  kitchen_remodeling: {
    base: [12000, 18000],
    perSqFt: [150, 300],
    multipliers: {
      layoutChange: 1.25,
      customCabinets: 1.3,
      permitRequired: 1.15,
      highEndFinish: 1.2,
    },
  },

  plumbing_repair: {
    base: [250, 600],
    emergency: 1.5,
    perFixture: [150, 350],
  },
} as const;

export type PricingServices = string;
