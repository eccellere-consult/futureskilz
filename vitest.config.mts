import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  // Same "@/" alias as tsconfig, so server modules can be tested without rewriting their imports.
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: { reporter: ["text", "json", "html"] },
  },
});
