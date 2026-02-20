import type { NextConfig } from "next";
import { execSync } from "child_process";

function getBuildId(): string {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    return Date.now().toString(36);
  }
}

const BUILD_ID = getBuildId();

const nextConfig: NextConfig = {
  output: "standalone",
  generateBuildId: async () => BUILD_ID,
  env: {
    NEXT_PUBLIC_BUILD_ID: BUILD_ID,
  },
};

export default nextConfig;
