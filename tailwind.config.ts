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
        surface: {
          primary: "#0d1117",
          card: "#161b22",
          elevated: "#1c2128",
        },
        edge: {
          DEFAULT: "#30363d",
          subtle: "#21262d",
        },
        content: {
          primary: "#e6edf3",
          secondary: "#7d8590",
          tertiary: "#484f58",
        },
        accent: {
          DEFAULT: "#2f81f7",
          subtle: "rgba(47, 129, 247, 0.1)",
          hover: "#388bfd",
        },
        status: {
          success: "#3fb950",
          warning: "#d29922",
          danger: "#f85149",
        },
      },
    },
  },
  plugins: [],
};

export default config;
