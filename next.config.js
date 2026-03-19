/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable static page caching so deployments take effect immediately
  headers: async () => [
    {
      source: "/:path*",
      headers: [
        {
          key: "Cache-Control",
          value: "no-cache, no-store, must-revalidate",
        },
      ],
    },
  ],
};

module.exports = nextConfig;
