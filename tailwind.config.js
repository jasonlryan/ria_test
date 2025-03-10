/** @type {import('tailwindcss').Config} */

const plugin = require("tailwindcss/plugin");

module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
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
      },
      listStyleType: {
        square: "square",
        roman: "lower-roman",
      },
    },
  },
  plugins: [
    plugin(function ({ addVariant }) {
      addVariant("hocus", ["&:hover", "&:focus"]);
    }),
  ],
};
