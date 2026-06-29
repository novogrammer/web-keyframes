import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/cli/index.ts", "src/editor.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  skipNodeModulesBundle: true,
  noExternal: ["preact"],
});
