import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // Enable Docker build optimizations
  experimental: {
    // Avoid auto-purge for Docker layer caching
    optimizePackageImports: ['react', 'react-dom'],
  },
  // Add any additional config options here
};

export default nextConfig;
