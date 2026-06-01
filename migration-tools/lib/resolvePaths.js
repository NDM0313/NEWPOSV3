import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const TOOLS_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

export function loadConfig(configPath) {
  const raw = fs.readFileSync(configPath, 'utf8');
  return JSON.parse(raw);
}

export function resolveDumpPath(args, config) {
  const positional = args.filter((a) => !a.startsWith('--') && !a.endsWith('.json'));
  if (positional[0]) return path.resolve(positional[0]);

  const candidates = [
    config?.dumpPath ? path.resolve(TOOLS_ROOT, config.dumpPath) : null,
    path.resolve(TOOLS_ROOT, '..', '62547.sql'),
    path.resolve(process.env.USERPROFILE || process.env.HOME || '', 'Downloads', '62547.sql'),
  ].filter(Boolean);

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return candidates[0];
}

export function resolveOutputDir(config) {
  return path.resolve(TOOLS_ROOT, config?.outputDir || './output');
}
