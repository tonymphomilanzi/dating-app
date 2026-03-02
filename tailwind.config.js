/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50:"#f8f5ff",100:"#f3eaff",200:"#e6d6ff",300:"#d2b5ff",
          400:"#b884ff",500:"#9c5aff",600:"#7c3aed",700:"#6d28d9",
          800:"#5b21b6",900:"#4c1d95",
        },
      },
      boxShadow: {
        card: "0 8px 30px rgba(0,0,0,0.10)",
        glow: "0 10px 25px rgba(124,58,237,0.35)",
      },
      borderRadius: { xl2: "1.25rem" },
    },
  },
  plugins: [],
}