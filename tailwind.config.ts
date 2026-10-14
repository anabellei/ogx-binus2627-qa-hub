import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { 50: "#eef6ff", 100: "#d9eaff", 200: "#bcdbff", 500: "#2b7fff", 600: "#0a6cf0", 700: "#0857c4" },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
      },
      keyframes: {
        slide: { "0%": { transform: "translateX(-100%)" }, "100%": { transform: "translateX(250%)" } },
        pop: { "0%": { transform: "scale(.96)", opacity: "0" }, "100%": { transform: "scale(1)", opacity: "1" } },
      },
      animation: { slide: "slide 1.2s ease-in-out infinite", pop: "pop .18s ease-out" },
    },
  },
  plugins: [],
};
export default config;
