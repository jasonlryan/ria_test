/** @type {import('tailwindcss').Config} */

const plugin = require("tailwindcss/plugin");

module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./styles/**/*.css",
  ],
  theme: {
    screens: {
      xs: "480px",
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
      "2xl": "1536px",
    },
    extend: {
      fontFamily: {
        sans: "Gotham",
      },
      colors: {
        myBg: "#F5F5F5",
        myPrimary: "#7899C5",
        mySecondary: "#A7C7E7",

        // Korn Ferry colors
        primary: "#00634f",
        secondary: "#009b77",
        tertiary: "#2c2c2c",

        // Primary color scale for collapsible blocks
        "primary-50": "#e6f7f4",
        "primary-100": "#ccefe9",
        "primary-200": "#99dfd3",
        "primary-300": "#66cfbd",
        "primary-400": "#33bfa7",
        "primary-500": "#00af91",
        "primary-600": "#00a184",
        "primary-700": "#008c74",
        "primary-800": "#007864",
        "primary-900": "#006354",
      },
      listStyleType: {
        square: "square",
        roman: "lower-roman",
      },
      textColor: {
        primary: "#00634f",
        secondary: "#009b77",
      },
    },
  },
  plugins: [
    plugin(function ({ addVariant }) {
      addVariant("hocus", ["&:hover", "&:focus"]);
    }),
    require("@tailwindcss/typography"),
  ],
};
