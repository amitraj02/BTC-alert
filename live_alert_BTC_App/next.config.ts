import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname),
  allowedDevOrigins: ["192.168.0.7:3000", "192.168.0.7:3001", "localhost:3000", "localhost:3001"],
};

export default nextConfig;
