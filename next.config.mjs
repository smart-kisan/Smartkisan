const apiServerOrigin = process.env.API_SERVER_ORIGIN?.replace(/\/+$/, "");

if (process.env.VERCEL && !apiServerOrigin) {
  throw new Error(
    "API_SERVER_ORIGIN is required on Vercel and must point to the published Smart Kisan API service.",
  );
}

if (apiServerOrigin) {
  let parsedApiOrigin;
  try {
    parsedApiOrigin = new URL(apiServerOrigin);
  } catch {
    throw new Error("API_SERVER_ORIGIN must be a valid HTTP(S) origin.");
  }

  if (
    !["http:", "https:"].includes(parsedApiOrigin.protocol) ||
    parsedApiOrigin.pathname !== "/" ||
    parsedApiOrigin.search ||
    parsedApiOrigin.hash
  ) {
    throw new Error(
      "API_SERVER_ORIGIN must be an origin only, for example https://api.example.com.",
    );
  }
}

/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@workspace/api-client-react", "@workspace/api-zod"],
  experimental: {
    externalDir: true,
  },
  typescript: {
    tsconfigPath: "tsconfig.next.json",
  },
  env: {
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ??
      process.env.VITE_CLERK_PUBLISHABLE_KEY ??
      "",
    NEXT_PUBLIC_CLERK_PROXY_URL:
      process.env.NEXT_PUBLIC_CLERK_PROXY_URL ??
      process.env.VITE_CLERK_PROXY_URL ??
      "/api/__clerk",
  },
  async rewrites() {
    if (!process.env.VERCEL || !apiServerOrigin) return [];
    return [
      {
        source: "/api/:path*",
        destination: `${apiServerOrigin}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
