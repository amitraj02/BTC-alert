import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        crypto: {
          dark: "#0f1117",
          card: "#181a20",
          elevated: "#202430",
          border: "#2a2e3d",
          accent: "#94a3b8",
          silver: "#cbd5e1",
          green: "#0ecb81",
          red: "#f6465d",
          blue: "#38bdf8",
          purple: "#a855f7"
        }
      },
    },
  },
  plugins: [],
};
export default config;
