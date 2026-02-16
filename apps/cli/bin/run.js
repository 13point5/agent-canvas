#!/usr/bin/env bun

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// In built/published version, use dist. In dev, use src.
const distEntry = join(__dirname, "../dist/index.js");
const srcEntry = join(__dirname, "../src/index.ts");

if (existsSync(distEntry)) {
  await import(distEntry);
} else {
  await import(srcEntry);
}
