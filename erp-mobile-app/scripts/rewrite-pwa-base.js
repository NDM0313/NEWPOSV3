#!/usr/bin/env node
/** Rewrite index.html and manifest for /m/ base path */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(__dirname, '../dist');
const indexPath = path.join(dist, 'index.html');
const manifestPath = path.join(dist, 'manifest.webmanifest');

if (!fs.existsSync(indexPath)) process.exit(0);

let html = fs.readFileSync(indexPath, 'utf8');
// Only add /m/ prefix when the path does not already start with /m/ (avoid /m/m/ when Vite base is already /m/)
html = html.replace(/(href|src)="(?!\/m\/)(\/)/g, '$1="/m$2');
fs.writeFileSync(indexPath, html);

if (fs.existsSync(manifestPath)) {
  let manifest = fs.readFileSync(manifestPath, 'utf8');
  manifest = manifest.replace(/"\/icons\//g, '"/m/icons/');
  manifest = manifest.replace(/"scope":"\/"/, '"scope":"/m/"');
  manifest = manifest.replace(/"start_url":"\/"/, '"start_url":"/m/"');
  fs.writeFileSync(manifestPath, manifest);
}
