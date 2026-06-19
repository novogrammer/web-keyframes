import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const repoRoot = path.resolve(process.cwd());
const cliEntry = path.join(repoRoot, "dist", "cli", "index.js");

test("CLI converts a single JSON file to SCSS", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "wkf-cli-single-"));
  const inputPath = path.join(tempDir, "hero-logo.timeline.json");
  const outputPath = path.join(tempDir, "generated", "_animations.scss");

  await writeFile(
    inputPath,
    JSON.stringify({
      timelines: [
        {
          id: "hero-logo",
          duration: 1200,
          translate: {
            unit: "px",
            functionName: "global.vw",
          },
          keyframes: [
            {
              time: 0,
              opacity: 0,
              transforms: [
                { kind: "translate", x: 0, y: 40 },
                { kind: "scale", value: 1 },
                { kind: "rotate", value: 0 },
              ],
            },
            {
              time: 1200,
              opacity: 1,
              transforms: [
                { kind: "translate", x: 0, y: 0 },
                { kind: "scale", value: 1 },
                { kind: "rotate", value: 0 },
              ],
            },
          ],
        },
      ],
    }),
  );

  const result = await runCli(["to-scss", "--input", inputPath, "--output", outputPath]);
  const output = await readFile(outputPath, "utf8");

  assert.equal(result.code, 0);
  assert.match(result.stdout, /Wrote SCSS/);
  assert.match(output, /@keyframes hero-logo/);
});

test("CLI converts only .timeline.json files from a directory and joins them with blank lines", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "wkf-cli-directory-"));
  const outputPath = path.join(tempDir, "generated.scss");

  await writeFile(
    path.join(tempDir, "a.timeline.json"),
    JSON.stringify({
      timelines: [
        {
          id: "a",
          duration: 100,
          keyframes: [
            {
              time: 0,
              opacity: 0,
              transforms: [
                { kind: "translate", x: 0, y: 0 },
                { kind: "scale", value: 1 },
                { kind: "rotate", value: 0 },
              ],
            },
            {
              time: 100,
              opacity: 1,
              transforms: [
                { kind: "translate", x: 10, y: 10 },
                { kind: "scale", value: 1 },
                { kind: "rotate", value: 0 },
              ],
            },
          ],
        },
      ],
    }),
  );
  await writeFile(
    path.join(tempDir, "b.timeline.json"),
    JSON.stringify({
      timelines: [
        {
          id: "b",
          duration: 100,
          keyframes: [
            {
              time: 0,
              opacity: 0,
              transforms: [
                { kind: "translate", x: 0, y: 0 },
                { kind: "scale", value: 1 },
                { kind: "rotate", value: 0 },
              ],
            },
            {
              time: 100,
              opacity: 1,
              transforms: [
                { kind: "translate", x: 20, y: 20 },
                { kind: "scale", value: 1 },
                { kind: "rotate", value: 0 },
              ],
            },
          ],
        },
      ],
    }),
  );
  await writeFile(path.join(tempDir, "ignore.json"), "{}");

  const result = await runCli(["to-scss", "--input", tempDir, "--output", outputPath]);
  const output = await readFile(outputPath, "utf8");

  assert.equal(result.code, 0);
  assert.match(output, /@keyframes a/);
  assert.match(output, /@keyframes b/);
  assert.doesNotMatch(output, /ignore/);
  assert.match(output, /}\n\n@keyframes b/);
});

test("CLI reports invalid JSON with the file path", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "wkf-cli-invalid-json-"));
  const inputPath = path.join(tempDir, "broken.timeline.json");
  const outputPath = path.join(tempDir, "generated.scss");

  await writeFile(inputPath, "{invalid json");

  const result = await runCli(["to-scss", "--input", inputPath, "--output", outputPath]);

  assert.equal(result.code, 1);
  assert.match(result.stderr, /Invalid JSON/);
  assert.match(result.stderr, /broken\.timeline\.json/);
});

test("CLI fails for missing input paths", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "wkf-cli-missing-input-"));
  const inputPath = path.join(tempDir, "missing.timeline.json");
  const outputPath = path.join(tempDir, "generated.scss");

  const result = await runCli(["to-scss", "--input", inputPath, "--output", outputPath]);

  assert.equal(result.code, 1);
  assert.match(result.stderr, /Input path does not exist/);
});

test("CLI fails when --output is omitted", async () => {
  const result = await runCli(["to-scss", "--input", "somewhere"]);

  assert.equal(result.code, 1);
  assert.match(result.stderr, /--output is required/);
});

function runCli(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cliEntry, ...args], {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}
