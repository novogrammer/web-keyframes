import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import * as sass from "sass";

const sourcePath = path.resolve("src/editor/editor.scss");
const outputPath = path.resolve("dist/editor.css");

await mkdir(path.dirname(outputPath), { recursive: true });
const result = sass.compile(sourcePath, { style: "expanded" });
await writeFile(outputPath, `${result.css}\n`);
