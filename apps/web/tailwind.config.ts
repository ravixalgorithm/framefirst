import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)"],
        heading: ["var(--font-heading)"],
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--text)",
        card: "var(--surface)",
        "card-foreground": "var(--text)",
        popover: "var(--surface)",
        "popover-foreground": "var(--text)",
        primary: {
          DEFAULT: "var(--accent-strong)",
          foreground: "white",
        },
        secondary: {
          DEFAULT: "var(--surface-muted)",
          foreground: "var(--text)",
        },
        muted: {
          DEFAULT: "var(--surface-muted)",
          foreground: "var(--muted)",
        },
        accent: {
          DEFAULT: "var(--surface-muted)",
          foreground: "var(--text)",
        },
        destructive: {
          DEFAULT: "var(--danger)",
          foreground: "white",
        },
        border: "var(--border)",
        input: "var(--border)",
        ring: "var(--accent-strong)",
      },
      borderRadius: {
        lg: "var(--radius-lg)",
        md: "var(--radius-md)",
        sm: "var(--radius-sm)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
