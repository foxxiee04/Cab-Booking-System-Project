#!/usr/bin/env node
/**
 * Render all `*.md` mermaid diagrams in this folder to PNG using mmdc.
 *
 * Usage:
 *   node docs/diagrams-v2/render.mjs            # render all
 *   node docs/diagrams-v2/render.mjs 05         # render only files starting with "05"
 *
 * Output goes to docs/diagrams-v2/png/<basename>.png (no -1 suffix when only
 * one diagram per file — mmdc's default suffix is renamed for clean filenames).
 */

import { execSync } from 'node:child_process';
import { readdirSync, renameSync, statSync, unlinkSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const SRC_DIR = __dirname;
const OUT_DIR = path.join(__dirname, 'png');
const CONFIG = path.join(__dirname, 'mermaid.config.json');
const filter = (process.argv[2] || '').trim();

const files = readdirSync(SRC_DIR)
  .filter((f) => f.endsWith('.md') && !/^README/i.test(f))
  .filter((f) => !filter || f.startsWith(filter))
  .sort();

if (files.length === 0) {
  console.log('No matching .md files found');
  process.exit(0);
}

console.log(`Rendering ${files.length} diagram file(s) to ${path.relative(ROOT, OUT_DIR)}`);

let ok = 0;
let failed = 0;

for (const file of files) {
  const baseName = path.basename(file, '.md');
  const inputPath = path.join(SRC_DIR, file);
  const finalOutput = path.join(OUT_DIR, `${baseName}.png`);

  process.stdout.write(`  • ${file} → ${path.basename(finalOutput)} ... `);

  try {
    execSync(
      `npx mmdc -i "${inputPath}" -o "${finalOutput}" -c "${CONFIG}" --theme default --backgroundColor white --width 1800 --scale 2`,
      { cwd: ROOT, stdio: 'pipe' },
    );

    // mmdc appends -1 (or -2, -3, ...) to filenames when rendering from .md.
    // For single-diagram files, rename -1 → no suffix; for multi-diagram files,
    // keep numbered suffix.
    const dashOnePath = path.join(OUT_DIR, `${baseName}-1.png`);
    const dashTwoPath = path.join(OUT_DIR, `${baseName}-2.png`);
    if (existsSync(dashOnePath) && !existsSync(dashTwoPath)) {
      // Single-diagram file: rename -1 to clean name.
      if (existsSync(finalOutput)) unlinkSync(finalOutput);
      renameSync(dashOnePath, finalOutput);
    }
    const size = statSync(existsSync(finalOutput) ? finalOutput : dashOnePath).size;
    console.log(`✓ (${(size / 1024).toFixed(0)}KB)`);
    ok += 1;
  } catch (err) {
    console.log('✗');
    console.error(`    ${(err.stderr?.toString() || err.message).slice(0, 200)}`);
    failed += 1;
  }
}

console.log(`\nDone — ${ok} rendered, ${failed} failed.`);
process.exit(failed === 0 ? 0 : 1);
