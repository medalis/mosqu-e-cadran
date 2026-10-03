import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Image Docker : serveur autonome (.next/standalone), activé par NEXT_OUTPUT=standalone (défini dans le Dockerfile).
  // Sur Vercel, la variable est absente et la sortie reste celle par défaut. La racine de traçage est celle du
  // monorepo pnpm, sinon les paquets @nidaa/* et les liens symboliques de node_modules ne sont pas copiés.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  outputFileTracingRoot: path.join(__dirname, "../.."),
  transpilePackages: ["@nidaa/shared", "@nidaa/prayer-engine"],
};

export default nextConfig;
