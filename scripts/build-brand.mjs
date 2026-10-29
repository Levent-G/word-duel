// Renders the app icon, Android adaptive icon, splash and favicon from src/brand/mark.js.
// Usage: npm run brand
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

import { markSvg } from '../src/brand/mark.js';
import { rgbPng } from './png-rgb.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = (name) => resolve(root, 'assets', name);
mkdirSync(resolve(root, 'assets'), { recursive: true });

function png(svg, size, file, { opaque = false } = {}) {
  const img = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render();
  writeFileSync(out(file), opaque ? rgbPng(img.pixels, img.width, img.height) : img.asPng());
  console.log(`${file} ${size}px${opaque ? ' (no alpha)' : ''}`);
}

// iOS / store icon: full-bleed square, the OS rounds the corners. Apple refuses icons with alpha.
png(markSvg({ bg: 'full', padding: 13 }), 1024, 'icon.png', { opaque: true });
// Android adaptive foreground: transparent, mark inside the 66% safe zone. Background colour is set in app.json.
png(markSvg({ bg: 'none', padding: 27 }).replace('stroke="none"', 'stroke="#36B985"').replace('stroke-width="0"', 'stroke-width="5"'), 1024, 'adaptive-icon.png');
// Splash: rounded tile on the app background colour.
png(markSvg({ bg: 'rounded', padding: 15 }), 512, 'splash-icon.png');
png(markSvg({ bg: 'rounded', padding: 15 }), 96, 'favicon.png');
// Preview of the rounded tile, handy for checking the design.
png(markSvg({ bg: 'rounded', padding: 15 }), 256, 'logo-preview.png');
