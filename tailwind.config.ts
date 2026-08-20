import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Core palette
        navy: "#1a1f8f",
        navylight: "#4a4faa",
        navymuted: "#7a7eb8",
        skyblue: "#8ec6e8",
        gold: "#c8a24a", // muted brass — governmental accent
        goldlight: "#e3c878",
        ncred: "#8c1616", // deep crimson — secondary accent across the site
        badge: "#eaebf8", // bill-number / tag tint
        pagebg: "#f6f8fa", // body background
        // Party
        democrat: "#2aa1ff",
        republican: "#d7262f", // bright red — Republican badges/labels
        // Status / sentiment
        lowrisk: "#057a55",
        medrisk: "#d97706",
        posbg: "#f0fdf4",
        posborder: "#bbf7d0",
        negbg: "#fff0f0",
        negborder: "#f0c0c0",
      },
      fontFamily: {
        sans: ["var(--font-ibm-plex-sans)", "system-ui", "sans-serif"],
        serif: ["var(--font-playfair)", "Georgia", "serif"],
        mono: ["var(--font-ibm-plex-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
