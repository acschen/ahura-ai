/** @type {import('next').NextConfig} */
const nextConfig = {
  // Generate unique build IDs to bust cache on every deploy
  generateBuildId: async () => {
    return Date.now().toString();
  },
};

module.exports = nextConfig;
