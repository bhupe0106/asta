/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        abyss: "#08090D",
        coal: "#101117",
        panel: "#151720",
        elevated: "#1B1E29",
        crimson: "#8B1E2D",
        ember: "#B52C43",
        arcane: "#7957C8",
        gold: "#C6A66A",
        parchment: "#F5F2ED",
        ash: "#9B9CAA",
        line: "#292B38",
        success: "#45A77B",
        danger: "#D64A56",
      },
      fontFamily: {
        sans: ["Inter", "Geist", "system-ui", "sans-serif"],
        display: ["Cinzel", "Georgia", "serif"],
        mono: ["JetBrains Mono", "Consolas", "monospace"],
      },
      boxShadow: {
        grimoire: "0 24px 80px -32px rgba(0,0,0,0.9), 0 0 0 1px rgba(198,166,106,0.08) inset",
        ember: "0 0 32px -8px rgba(181,44,67,0.45)",
        "ember-lg": "0 0 80px -20px rgba(181,44,67,0.5)",
      },
      backgroundImage: {
        "radial-ember": "radial-gradient(ellipse at 50% -10%, rgba(139,30,45,0.28), transparent 60%)",
        "radial-arcane": "radial-gradient(ellipse at 80% 10%, rgba(121,87,200,0.12), transparent 55%)",
        "rune-grid":
          "linear-gradient(rgba(198,166,106,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(198,166,106,0.035) 1px, transparent 1px)",
      },
      backgroundSize: { "rune-grid": "56px 56px" },
      keyframes: {
        emberDrift: {
          "0%": { transform: "translateY(0) translateX(0)", opacity: "0" },
          "10%": { opacity: "0.6" },
          "100%": { transform: "translateY(-120px) translateX(14px)", opacity: "0" },
        },
        pulseRune: {
          "0%, 100%": { opacity: "0.35" },
          "50%": { opacity: "0.85" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "ember-drift": "emberDrift 9s linear infinite",
        "pulse-rune": "pulseRune 4.5s ease-in-out infinite",
        shimmer: "shimmer 2.2s linear infinite",
      },
    },
  },
  plugins: [],
};
