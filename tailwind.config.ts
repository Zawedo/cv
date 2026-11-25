import type { Config } from "tailwindcss";

// Palette inspirée de la DA Winamax : rouge vif, noir profond, blanc.
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        wina: {
          red: "#E30613",
          "red-dark": "#B0040E",
          black: "#0B0B0B",
          ink: "#141414",
          card: "#1C1C1C",
          line: "#2C2C2C",
          muted: "#9A9A9A",
          gold: "#F5C400",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Impact", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
