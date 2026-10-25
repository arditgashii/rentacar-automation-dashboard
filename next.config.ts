import type { NextConfig } from "next";

// Every page depends on the session and on live data, so the classic dynamic rendering model is
// used instead of Cache Components.
const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
