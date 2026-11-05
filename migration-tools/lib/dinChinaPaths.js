import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export function repoRoot() {
  return REPO_ROOT;
}

export function dinChinaRoot() {
  return path.join(REPO_ROOT, 'DIN CHINA');
}

export function dryRunDir() {
  return path.join(dinChinaRoot(), '03_dry_run_reports');
}

export function mapsDir() {
  return path.join(dinChinaRoot(), '07_maps_json');
}

export function archivedCsvDir() {
  return path.join(dinChinaRoot(), '08_archived_old_december_files');
}

export function ensureDinChinaDirs() {
  for (const dir of [dryRunDir(), mapsDir()]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
