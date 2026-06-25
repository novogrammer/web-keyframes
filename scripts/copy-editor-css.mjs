import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import * as sass from "sass";

const sourcePath = path.resolve("src/editor/editor.scss");
const outputPath = path.resolve("dist/editor.css");
const outputModulePath = path.resolve("src/editor/generatedEditorCss.ts");

await mkdir(path.dirname(outputPath), { recursive: true });
const result = sass.compile(sourcePath, { style: "expanded" });
await writeFile(outputPath, `${result.css}\n`);
await writeFile(
  outputModulePath,
  `export const EDITOR_CSS_TEXT = ${JSON.stringify(`${result.css}\n`)};\n`,
);
