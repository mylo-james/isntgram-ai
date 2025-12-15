import path from "node:path";
import { PHASE_PRODUCTION_SERVER } from "next/constants.js";

/** @type {import("next").NextConfig} */
const nextConfig = {
  output: "standalone",
  // Required for monorepos so output file tracing can include shared workspace packages.
  outputFileTracingRoot: path.join(process.cwd(), "../.."),
};

const configFactory = (phase) => {
  // Only validate secrets when starting the production server (not during `next build`).
  if (phase === PHASE_PRODUCTION_SERVER) {
    if (!process.env.AUTH_SECRET && !process.env.NEXTAUTH_SECRET) {
      throw new Error("AUTH_SECRET or NEXTAUTH_SECRET must be set in production");
    }
  }

  return nextConfig;
};

export default configFactory;
