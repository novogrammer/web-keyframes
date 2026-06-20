import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as sass from "sass";
import { generateCss } from "web-keyframes";

const here = path.dirname(fileURLToPath(import.meta.url));
const exampleRoot = path.resolve(here, "..");
const srcDir = path.join(exampleRoot, "src");
const distDir = path.join(exampleRoot, "dist");
const animationsDir = path.join(srcDir, "animations");
const vendorSourceDir = path.join(exampleRoot, "node_modules", "web-keyframes", "dist");
const vendorTargetDir = path.join(distDir, "vendor", "web-keyframes", "dist");

await rm(distDir, { recursive: true, force: true });

await mkdir(path.join(distDir, "generated"), { recursive: true });
await mkdir(path.join(distDir, "animations"), { recursive: true });

await cp(path.join(srcDir, "index.html"), path.join(distDir, "index.html"));
await cp(path.join(srcDir, "main.js"), path.join(distDir, "main.js"));
await cp(animationsDir, path.join(distDir, "animations"), { recursive: true });
await cp(vendorSourceDir, vendorTargetDir, { recursive: true });

const styleResult = sass.compile(path.join(srcDir, "styles", "example.scss"), { style: "expanded" });
await writeFile(path.join(distDir, "generated", "example.css"), `${styleResult.css}\n`);

const animationFiles = (await readdir(animationsDir))
  .filter((file) => file.endsWith(".timeline.json"))
  .sort();

const cssChunks = [];
for (const file of animationFiles) {
  const input = JSON.parse(await readFile(path.join(animationsDir, file), "utf8"));
  cssChunks.push(generateCss(input).trimEnd());
}

await writeFile(
  path.join(distDir, "generated", "animations.css"),
  cssChunks.join("\n\n") + "\n",
);
