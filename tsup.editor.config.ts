import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/editor.ts"],
  format: ["esm"],
  dts: true,
  clean: false,
  skipNodeModulesBundle: true,
  noExternal: ["preact"],
});
