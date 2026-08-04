import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
];

const privateNoStoreHeader = {
  key: "Cache-Control",
  value: "private, no-store, max-age=0",
};

function validateProductionEnvironment() {
  if (process.env.NODE_ENV !== "production") return;

  for (const name of ["AUTH_SECRET", "DATABASE_URL"] as const) {
    if (!process.env[name]?.trim()) {
      throw new Error(`${name} is required in production.`);
    }
  }

  const canonicalUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL;

  if (!canonicalUrl) return;

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(canonicalUrl);
  } catch {
    throw new Error("The configured Auth.js application URL is invalid.");
  }

  if (parsedUrl.protocol !== "https:") {
    throw new Error("The Auth.js application URL must use HTTPS in production.");
  }
}

validateProductionEnvironment();

const nextConfig: NextConfig = {
  reactCompiler: true,

  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/dashboard/:path*",
        headers: [privateNoStoreHeader],
      },
      {
        source: "/registrar/:path*",
        headers: [privateNoStoreHeader],
      },
      {
        source: "/principal/:path*",
        headers: [privateNoStoreHeader],
      },
      {
        source: "/teacher/:path*",
        headers: [privateNoStoreHeader],
      },
      {
        source: "/account/:path*",
        headers: [privateNoStoreHeader],
      },
      {
        source: "/session-invalid",
        headers: [privateNoStoreHeader],
      },
      {
        source: "/api/:path*",
        headers: [privateNoStoreHeader],
      },
    ];
  },
};

export default nextConfig;
