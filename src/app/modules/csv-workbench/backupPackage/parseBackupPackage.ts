/**
 * Parse uploaded backup ZIP into manifest + CSV file map.
 */

import JSZip from 'jszip';
import { BACKUP_ENTITY_DEFINITIONS } from './backupEntityRegistry';
import type { BackupEntityKey, BackupManifest, ParsedBackupPackage } from './types';

const FILENAME_TO_KEY = Object.fromEntries(
  BACKUP_ENTITY_DEFINITIONS.map((d) => [d.filename, d.key])
) as Record<string, BackupEntityKey>;

export async function parseBackupPackage(file: File): Promise<ParsedBackupPackage> {
  const buf = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buf);

  const manifestEntry = zip.file('manifest.json');
  if (!manifestEntry) {
    throw new Error('Invalid backup package: manifest.json is missing.');
  }

  const manifestText = await manifestEntry.async('string');
  const manifest = JSON.parse(manifestText) as BackupManifest;

  if (!manifest.company_id || !manifest.schema_version) {
    throw new Error('Invalid manifest: missing company_id or schema_version.');
  }

  const files: ParsedBackupPackage['files'] = {};

  for (const def of BACKUP_ENTITY_DEFINITIONS) {
    const entry = zip.file(def.filename);
    if (entry) {
      files[def.key] = await entry.async('string');
    }
  }

  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir || path === 'manifest.json') continue;
    const base = path.split('/').pop() ?? path;
    const key = FILENAME_TO_KEY[base];
    if (key && !files[key]) {
      files[key] = await entry.async('string');
    }
  }

  return { manifest, files };
}

export function countRowsInCsv(csv: string | undefined): number {
  if (!csv?.trim()) return 0;
  const lines = csv.trim().split(/\r?\n/).filter(Boolean);
  return Math.max(0, lines.length - 1);
}
