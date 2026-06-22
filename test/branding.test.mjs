import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const prefix = String.fromCharCode(109, 105, 114, 111);
const forbidden = [prefix, "thinker"].join("");
const forbiddenTerms = [
  forbidden,
  [prefix, " thinker"].join(""),
  [prefix, "-thinker"].join(""),
  [prefix, "_thinker"].join(""),
];
const skippedDirectories = new Set([".git", "node_modules"]);
const textExtensions = new Set([
  ".cs",
  ".css",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".ps1",
  ".txt",
]);

async function walk(relative = "") {
  const absolute = path.join(root, relative);
  const entries = await readdir(absolute, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (skippedDirectories.has(entry.name)) continue;
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) files.push(...await walk(child));
    else files.push(child);
  }
  return files;
}

function matchesForbidden(value) {
  const lower = value.toLowerCase();
  return forbiddenTerms.some((term) => lower.includes(term));
}

test("source and distribution names do not contain restricted brand terms", async () => {
  const files = await walk();
  const pathHits = files.filter((file) => matchesForbidden(file));
  assert.deepEqual(pathHits, []);

  const contentHits = [];
  for (const file of files) {
    if (!textExtensions.has(path.extname(file).toLowerCase())) continue;
    const content = await readFile(path.join(root, file), "utf8");
    if (matchesForbidden(content)) contentHits.push(file);
  }
  assert.deepEqual(contentHits, []);
});

test("windows launcher is renamed and can be minimized", async () => {
  const launcherPath = path.join(root, "launcher", "LocalResearchAgentLauncher.cs");
  assert.equal(existsSync(launcherPath), true);

  const source = await readFile(launcherPath, "utf8");
  assert.match(source, /namespace LocalResearchAgentLauncher/);
  assert.match(source, /Text = "Local Research Agent Launcher"/);
  assert.match(source, /MinimizeBox = true/);
  assert.doesNotMatch(source, /MinimizeBox = false/);
});
