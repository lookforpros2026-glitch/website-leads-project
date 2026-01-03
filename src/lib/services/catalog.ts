export type ServiceCategory = "Remodel" | "Repair" | "Emergency" | "Install" | "Exterior";

export type Service = {
  key: string;
  label: string;
  category: ServiceCategory;
  isEmergency?: boolean;
};

export const SERVICES: Service[] = [
  { key: "kitchen-remodeling", label: "Kitchen Remodeling", category: "Remodel" },
  { key: "bathroom-remodeling", label: "Bathroom Remodeling", category: "Remodel" },
  { key: "home-addition", label: "Home Addition", category: "Remodel" },
  { key: "adu-construction", label: "ADU Construction", category: "Remodel" },

  { key: "roof-repair", label: "Roof Repair", category: "Repair" },
  { key: "hvac-repair", label: "HVAC Repair", category: "Repair" },
  { key: "plumbing-repair", label: "Plumbing Repair", category: "Repair" },
  { key: "electrical-repair", label: "Electrical Repair", category: "Repair" },

  { key: "emergency-plumbing", label: "Emergency Plumbing", category: "Emergency", isEmergency: true },
  { key: "emergency-electrical", label: "Emergency Electrical", category: "Emergency", isEmergency: true },
  { key: "roof-leak-emergency", label: "Roof Leak Emergency", category: "Emergency", isEmergency: true },

  { key: "solar-installation", label: "Solar Installation", category: "Install" },
  { key: "hvac-installation", label: "HVAC Installation", category: "Install" },
  { key: "window-installation", label: "Window Installation", category: "Install" },

  { key: "exterior-painting", label: "Exterior Painting", category: "Exterior" },
  { key: "siding-replacement", label: "Siding Replacement", category: "Exterior" },
  { key: "gutter-installation", label: "Gutter Installation", category: "Exterior" },
];
