import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./hooks/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        aletheia: {
          bg: "#080808",
          surface: "#111111",
          border: "#1e1e1e",
          text: "#f0ede8",
          secondary: "#6b6560",
          gold: "#c8892a",
          goldHover: "#e0a040",
          success: "#2a7a4a",
          danger: "#7a2a2a",
          sealed: "#1a3a5c",
          revealed: "#c8892a",
        },
      },
    },
  },
  plugins: [],
};

export default config;
