import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
]

const pageNoStoreHeaders = [
  { key: "Cache-Control", value: "private, no-cache, no-store, max-age=0, must-revalidate" },
]

const nextConfig: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  headers: async () => [
    {
      source: "/(.*)",
      headers: securityHeaders,
    },
    ...[
      "/",
      "/developers",
      "/hall-of-fame",
      "/ranking",
      "/search",
      "/login",
      "/register",
      "/wallet",
      "/tweet/:path*",
      "/user/:path*",
      "/admin",
    ].map((source) => ({
      source,
      headers: pageNoStoreHeaders,
    })),
  ],
};

export default nextConfig;
