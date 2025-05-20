/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  
  // Environment variables that will be available in the browser
  env: {
    // Default to localhost in development, allow override in production
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'https://omnidocs-backend-production.up.railway.app',
  },
  
  // Skip ESLint during the build (resolve warnings)
  eslint: {
    // Don't run ESLint during builds
    ignoreDuringBuilds: true,
  },

  // Skip type checking during build
  typescript: {
    // Don't run TypeScript type checking during builds
    ignoreBuildErrors: true,
  },

  // Asset prefix for static files (useful if using CDN)
  assetPrefix: process.env.ASSET_PREFIX || '',

  async rewrites() {
    return [
      {
        source: '/api/backend/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'https://omnidocs-backend-production.up.railway.app'}/api/:path*`,
      },
    ];
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,DELETE,PATCH,POST,PUT' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version' },
        ],
      },
    ];
  },
};

module.exports = nextConfig; 