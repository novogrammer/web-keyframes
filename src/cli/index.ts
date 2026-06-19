import { Dirent } from "node:fs";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { formatCss, generateCss, validateWebKeyframesDocument } from "../core/index.js";
import type { WebKeyframesDocument } from "../core/index.js";

type CliIO = {
  stdout?: Pick<typeof process.stdout, "write">;
  stderr?: Pick<typeof process.stderr, "write">;
};

export async function main(args: string[], io: CliIO = {}): Promise<number> {
  const stdout = io.stdout ?? process.stdout;
  const stderr = io.stderr ?? process.stderr;

  try {
    const command = args[0];

    if (command !== "to-css") {
      throw new Error(`Unknown command: ${command ?? "(missing)"}`);
    }

    const parsed = parseToCssArgs(args.slice(1));
    const css = await buildCssFromInput(parsed.input);

    await mkdir(path.dirname(parsed.output), { recursive: true });
    await writeFile(parsed.output, css, "utf8");

    stdout.write(`Wrote CSS to ${parsed.output}\n`);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    stderr.write(`${message}\n`);
    return 1;
  }
}

type ToCssArgs = {
  input: string;
  output: string;
};

function parseToCssArgs(args: string[]): ToCssArgs {
  const options = new Map<string, string>();

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];

    if (token !== "--input" && token !== "--output") {
      throw new Error(`Unknown option: ${token}`);
    }

    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`${token} requires a value.`);
    }

    options.set(token, value);
    index += 1;
  }

  const input = options.get("--input");
  const output = options.get("--output");

  if (!input) {
    throw new Error("--input is required.");
  }

  if (!output) {
    throw new Error("--output is required.");
  }

  return { input, output };
}

async function buildCssFromInput(inputPath: string): Promise<string> {
  let inputStat;

  try {
    inputStat = await stat(inputPath);
  } catch {
    throw new Error(`Input path does not exist: ${inputPath}`);
  }

  if (inputStat.isDirectory()) {
    const filenames = await collectTimelineFiles(inputPath);
    const blocks = await Promise.all(
      filenames.map(async (filename) => {
        const absolutePath = path.join(inputPath, filename);
        return convertJsonFileToCss(absolutePath);
      }),
    );

    return formatCss(blocks.map((block) => block.trimEnd()));
  }

  if (!inputStat.isFile()) {
    throw new Error(`Input path must be a file or directory: ${inputPath}`);
  }

  return convertJsonFileToCss(inputPath);
}

async function collectTimelineFiles(directoryPath: string): Promise<string[]> {
  const entries = await readdir(directoryPath, { withFileTypes: true });

  return entries
    .filter((entry: Dirent) => entry.isFile() && entry.name.endsWith(".timeline.json"))
    .map((entry: Dirent) => entry.name)
    .sort((left: string, right: string) => left.localeCompare(right));
}

async function convertJsonFileToCss(filePath: string): Promise<string> {
  const source = await readFile(filePath, "utf8");
  const parsed = parseJsonFile(filePath, source);
  const validated = validateWebKeyframesDocument(parsed) as WebKeyframesDocument;

  return generateCss(validated);
}

function parseJsonFile(filePath: string, source: string): unknown {
  try {
    return JSON.parse(source);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid JSON in ${filePath}: ${message}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const exitCode = await main(process.argv.slice(2));
  process.exit(exitCode);
}
