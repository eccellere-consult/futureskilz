/** @type {import("next").NextConfig} */
const nextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // Document and spreadsheet readers run from node_modules rather than the server bundle: pdf.js loads its worker file at
  // run time (bundling drops it), and the vendored SheetJS reads uploads. Same list as the Eccellere app. Keep this a plain
  // object: Hostinger wraps next.config and drops function-form configs.
  serverExternalPackages: ["mammoth", "pdf-parse", "pdfjs-dist", "xlsx"],
  outputFileTracingIncludes: {
    "/api/self-service/upload": ["./node_modules/pdf-parse/dist/**/*", "./node_modules/pdfjs-dist/**/*"],
  },
};

export default nextConfig;
