import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";

const sourcePath = path.resolve("src/editor/editor.css");
const outputPath = path.resolve("dist/editor.css");

await mkdir(path.dirname(outputPath), { recursive: true });
await copyFile(sourcePath, outputPath);
