/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['www150.statcan.gc.ca'],
  },
  experimental: {
    appDir: true,
  },
};

module.exports = nextConfig;