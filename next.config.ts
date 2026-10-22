import type { NextConfig } from "next";
import path from "path";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  fallbacks: {
    document: "/",
  },
});

const framerShim = path.resolve(__dirname, "src/vendor/framer-shim.ts");

/** Production defaults when Vercel project env keys exist but are empty. */
const defaultPublicSupabaseUrl = "https://zjnikfrledckmjahwnsb.supabase.co";
const defaultPublicSupabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpqbmlrZnJsZWRja21qYWh3bnNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxNjg5MjAsImV4cCI6MjEwNTc0NDkyMH0.6teIFzZMLo0CNl9fqmO5KcdHfac05yAx9hF5rVvIfAw";

const nextConfig: NextConfig = {
  experimental: {
    /** Keep prefetched RSC payloads warm longer (faster tab switches). */
    staleTimes: {
      dynamic: 60,
      static: 300,
    },
  },
  env: {
    NEXT_PUBLIC_SUPABASE_URL:
      process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
      defaultPublicSupabaseUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
      defaultPublicSupabaseAnonKey,
    NEXT_PUBLIC_APP_URL:
      process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      "https://iplanet-pay.vercel.app",
    EMAIL_FROM:
      process.env.EMAIL_FROM?.trim() || "noreply@iplanet.com.br",
  },
  reactStrictMode: true,
  async redirects() {
    // Nome novo na interface (Wallet); a rota interna continua /app/carteira.
    return [{ source: "/app/wallet", destination: "/app/carteira", permanent: false }];
  },
  images: {
    qualities: [75, 85],
    // Fotos de produto ficam no Storage do Supabase (bucket product-images).
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  // Vendored Framer marketplace JS (THREE / USD parsers) ships as plain ESM.
  turbopack: {
    resolveAlias: {
      framer: framerShim,
    },
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      framer: framerShim,
    };
    return config;
  },
};

export default withPWA(nextConfig);
