/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.resolve.fallback = { fs: false, path: false };

    return config;
  },
  reactStrictMode: true,
  output: "standalone",
  distDir: ".next",
  experimental: {
    outputFileTracingIncludes: {
      "/**": [
        "utils/openai/*.md",
        "utils/openai/precompiled_starters/*.json",
        "scripts/output/split_data/*.json",
      ],
    },
  },
};

module.exports = nextConfig;
