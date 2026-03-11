import { loadEnvConfig } from "@next/env";
import { defineConfig } from "vitest/config";
import path from "node:path";

loadEnvConfig(process.cwd());

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup-env.ts"]
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname)
    }
  }
});
