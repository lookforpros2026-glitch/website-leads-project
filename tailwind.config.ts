import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: "#0b0f17",
        accent: "#6ef3ff",
        glass: "rgba(255,255,255,0.06)",
      },
      boxShadow: {
        glass: "0 10px 60px rgba(0,0,0,0.45)",
      },
    },
  },
  plugins: [],
};

export default config;
