import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

async function readServer() {
  return readFile(new URL("../server.js", import.meta.url), "utf8");
}

test("final research synthesis prompt requires inline citations and used references", async () => {
  const source = await readServer();

  assert.match(source, /FINAL_CITATION_INSTRUCTIONS/);
  assert.match(source, /Every factual claim derived from retrieval evidence MUST include an inline citation/);
  assert.match(source, /Do not place citations only in a final bibliography/);
  assert.match(source, /References used/);
  assert.match(source, /Only include sources that are cited in the answer body/);
});
