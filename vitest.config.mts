import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    // Redis/Lua behaviour is covered by the .kvtest harness against a real
    // server; vitest only runs what works in-process.
    include: ["{lib,components,app}/**/*.test.{ts,tsx}"],
  },
});
