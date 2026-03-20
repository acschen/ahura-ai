/** @type {import('next').NextConfig} */
const nextConfig = {
  generateBuildId: () => Date.now().toString(),
  headers: async () => [
    {
      source: "/:path*",
      headers: [
        { key: "Cache-Control", value: "no-store, max-age=0, must-revalidate" },
        { key: "Pragma", value: "no-cache" },
        { key: "Expires", value: "0" },
      ],
    },
  ],
};

module.exports = nextConfig;
