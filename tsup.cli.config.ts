import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli/index.ts"],
  outDir: "dist/cli",
  format: ["esm"],
  dts: true,
  clean: false,
  platform: "node",
});
