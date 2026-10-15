/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    API_SERVER_ORIGIN: process.env.API_SERVER_ORIGIN || "https://smart-kisan.replit.app",
  },
};

export default nextConfig;
