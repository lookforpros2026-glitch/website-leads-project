/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ["*"],
    },
  },
  webpack: (config, { dev }) => {
    if (dev) {
      // Disable persistent cache in dev to avoid corrupted pack cache issues on Windows.
      config.cache = false;
    }
    return config;
  },
};

module.exports = nextConfig;
