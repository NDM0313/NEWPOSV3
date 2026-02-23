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
html = html.replace(/(href|src)="\/(?!\/)/g, '$1="/m/');
fs.writeFileSync(indexPath, html);

if (fs.existsSync(manifestPath)) {
  let manifest = fs.readFileSync(manifestPath, 'utf8');
  manifest = manifest.replace(/"\/icons\//g, '"/m/icons/');
  manifest = manifest.replace(/"scope":"\/"/, '"scope":"/m/"');
  manifest = manifest.replace(/"start_url":"\/"/, '"start_url":"/m/"');
  fs.writeFileSync(manifestPath, manifest);
}
