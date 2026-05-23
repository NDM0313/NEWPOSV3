#!/usr/bin/env node
/**
 * Pin Gradle to JDK 17 so IDEs using JDK 25 do not fail with:
 * "Unsupported class file major version 69" / "Gradle 8.14 does not support Java 25".
 */
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { homedir, platform } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const KEY = 'org.gradle.java.home';

function javaMajor(jdkHome) {
  try {
    const r = spawnSync(join(jdkHome, 'bin', 'java'), ['-version'], {
      encoding: 'utf8',
    });
    const combined = `${r.stdout || ''}${r.stderr || ''}`;
    const m = combined.match(/version "(\d+)/);
    return m ? Number(m[1]) : null;
  } catch {
    return null;
  }
}

function tryJdkHome(home, seen) {
  if (!home || seen.has(home)) return null;
  seen.add(home);
  const javac = join(home, 'bin', platform() === 'win32' ? 'javac.exe' : 'javac');
  if (!existsSync(javac)) return null;
  const major = javaMajor(home);
  return major === 17 || major === 21 ? home : null;
}

function scanJdk17Dirs(base, seen) {
  if (!existsSync(base)) return null;
  try {
    for (const name of readdirSync(base)) {
      if (!/jdk-17|zulu-17|java-17|openjdk@17|jdk17/i.test(name)) continue;
      const found = tryJdkHome(join(base, name), seen);
      if (found) return found;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function findJdk17() {
  const seen = new Set();

  if (process.env.JAVA_HOME) {
    const fromEnv = tryJdkHome(process.env.JAVA_HOME, seen);
    if (fromEnv) return fromEnv;
  }

  if (platform() === 'win32') {
    const roots = [
      process.env.ProgramFiles,
      process.env['ProgramFiles(x86)'],
      join(process.env.LOCALAPPDATA || '', 'Programs', 'Eclipse Adoptium'),
    ].filter(Boolean);
    for (const root of roots) {
      const found = scanJdk17Dirs(join(root, 'Microsoft'), seen);
      if (found) return found;
      const adoptium = scanJdk17Dirs(join(root, 'Eclipse Adoptium'), seen);
      if (adoptium) return adoptium;
      const java = scanJdk17Dirs(join(root, 'Java'), seen);
      if (java) return java;
      const zulu = scanJdk17Dirs(join(root, 'Zulu'), seen);
      if (zulu) return zulu;
    }
  } else {
    for (const base of [
      '/usr/lib/jvm',
      '/opt/homebrew/opt',
      '/Library/Java/JavaVirtualMachines',
    ]) {
      const found = scanJdk17Dirs(base, seen);
      if (found) return found;
      if (base.includes('JavaVirtualMachines')) {
        try {
          for (const name of readdirSync(base)) {
            if (!name.includes('17')) continue;
            const home = join(base, name, 'Contents', 'Home');
            const ok = tryJdkHome(home, seen);
            if (ok) return ok;
          }
        } catch {
          /* ignore */
        }
      }
    }
  }

  return null;
}

function toGradlePath(p) {
  return p.replace(/\\/g, '/');
}

function upsertGradleProperty(filePath, jdkHome) {
  const value = toGradlePath(jdkHome);
  const line = `${KEY}=${value}`;
  let body = '';
  if (existsSync(filePath)) {
    body = readFileSync(filePath, 'utf8');
    const re = new RegExp(`^${KEY}=.*$`, 'm');
    if (re.test(body)) {
      body = body.replace(re, line);
    } else {
      body = `${body.trimEnd()}\n\n# Gradle daemon JVM (auto: scripts/ensure-gradle-jdk17.mjs)\n${line}\n`;
    }
  } else {
    mkdirSync(dirname(filePath), { recursive: true });
    body = `# Gradle daemon JVM (auto: scripts/ensure-gradle-jdk17.mjs)\n${line}\n`;
  }
  writeFileSync(filePath, body.endsWith('\n') ? body : `${body}\n`, 'utf8');
  return filePath;
}

function main() {
  const jdk17 = findJdk17();
  if (!jdk17) {
    console.error(
      'JDK 17/21 not found. Install JDK 17 (e.g. Eclipse Adoptium) and set JAVA_HOME, then re-run.',
    );
    process.exit(1);
  }

  const targets = [
    join(repoRoot, 'erp-mobile-app', 'android', 'gradle.properties'),
    join(homedir(), '.gradle', 'gradle.properties'),
    join(
      repoRoot,
      'POS',
      'node_modules',
      '@react-native',
      'gradle-plugin',
      'gradle.properties',
    ),
  ];

  const updated = [];
  for (const file of targets) {
    if (file.includes('node_modules') && !existsSync(dirname(file))) continue;
    upsertGradleProperty(file, jdk17);
    updated.push(file);
  }

  console.log(`Using JDK: ${jdk17}`);
  for (const f of updated) console.log(`Updated: ${f}`);
}

main();
