// Vitest configuration.
//
// Runs the pure-TypeScript unit tests under `lib/**/*.test.ts`. Node
// environment is enough — every target module is side-effect-free and
// doesn't touch DOM / Web Audio. Path alias `@` mirrors the tsconfig
// so test imports read the same as component imports.

import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
    globals: false,
  },
});
