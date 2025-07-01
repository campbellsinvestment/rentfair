/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',  // Enable static exports for GitHub Pages
  distDir: 'out',    // Output directory for the static build
  images: {
    unoptimized: true,  // Required for static export
  },
  // Configure basePath if deploying to a subdirectory
  // basePath: '/rentfair',
  trailingSlash: true,  // Add trailing slashes for GitHub Pages compatibility
  // Disable server-side features in static export
  experimental: {
    appDir: true,
  },
};

module.exports = nextConfig;