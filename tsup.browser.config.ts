import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/editor.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  platform: "browser",
  noExternal: ["lit-html", /^@lit\//],
});
