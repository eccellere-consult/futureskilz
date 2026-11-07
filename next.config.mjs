import { execSync } from "node:child_process";

// Which version is live? Shown by /api/health and the admin dashboard. The host may build without git metadata, so the time is the fallback.
function buildId() {
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim() || "unknown";
  } catch {
    return process.env.GITHUB_SHA ? process.env.GITHUB_SHA.slice(0, 7) : "unknown";
  }
}

/** @type {import("next").NextConfig} */
const nextConfig = {
  output: "standalone",
  env: { NEXT_PUBLIC_BUILD_ID: buildId(), NEXT_PUBLIC_BUILT_AT: new Date().toISOString() },
  poweredByHeader: false,
  // Document and spreadsheet readers run from node_modules rather than the server bundle: pdf.js loads its worker file at
  // run time (bundling drops it), and the vendored SheetJS reads uploads. Same list as the Eccellere app. Keep this a plain
  // object: Hostinger wraps next.config and drops function-form configs.
  serverExternalPackages: ["mammoth", "pdf-parse", "pdfjs-dist", "pdfkit", "xlsx"],
  outputFileTracingIncludes: {
    "/api/payments/invoices/[id]": ["./node_modules/pdfkit/js/**/*"],
    "/api/contribute/projects/[id]/book": ["./node_modules/pdfkit/js/**/*"],
    "/api/self-service/upload": ["./node_modules/pdf-parse/dist/**/*", "./node_modules/pdfjs-dist/**/*"],
  },
};

export default nextConfig;
