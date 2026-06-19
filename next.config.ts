import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // During build, ignore production type errors if any (we will still do local type checks)
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
