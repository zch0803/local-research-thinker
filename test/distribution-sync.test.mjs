import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("distribution app bundle matches the source app bundle", async () => {
  const distApp = new URL("../dist/LocalResearchAgent/app/public/app.js", import.meta.url);
  if (!existsSync(distApp)) return;

  const [source, distributed] = await Promise.all([
    readFile(new URL("../public/app.js", import.meta.url), "utf8"),
    readFile(distApp, "utf8"),
  ]);

  assert.equal(distributed, source);
});

