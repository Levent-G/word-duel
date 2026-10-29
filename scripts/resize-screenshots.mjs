// Turns iPhone screenshots into every size App Store Connect accepts (portrait, no alpha).
// Usage: put the screenshots in store/screenshots/raw, then: npm run screenshots
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

import { rgbPng } from './png-rgb.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const BASE = path.resolve(here, '../store/screenshots');
const RAW = path.join(BASE, 'raw');
const SIZES = [
  { dir: '6.9-inch-1320x2868', W: 1320, H: 2868 },
  { dir: '6.9-inch-1290x2796', W: 1290, H: 2796 },
  { dir: '6.5-inch-1284x2778', W: 1284, H: 2778 },
  { dir: '6.5-inch-1242x2688', W: 1242, H: 2688 },
  { dir: '6.3-inch-1206x2622', W: 1206, H: 2622 },
  { dir: '6.1-inch-1179x2556', W: 1179, H: 2556 },
];
fs.mkdirSync(RAW, { recursive: true });

const files = fs.readdirSync(RAW).filter((f) => /\.(png|jpe?g)$/i.test(f)).sort();
if (!files.length) {
  console.log(`Görüntü bulunamadı. iPhone ekran görüntülerini şuraya koy: ${RAW}`);
  process.exit(0);
}
for (const { dir, W, H } of SIZES) {
  const out = path.join(BASE, dir);
  fs.mkdirSync(out, { recursive: true });
  files.forEach((f, n) => {
    const buf = fs.readFileSync(path.join(RAW, f));
    const mime = /\.png$/i.test(f) ? 'image/png' : 'image/jpeg';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#F8FAFC"/><image width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice" xlink:href="data:${mime};base64,${buf.toString('base64')}"/></svg>`;
    const img = new Resvg(svg, { fitTo: { mode: 'original' } }).render();
    fs.writeFileSync(path.join(out, `${String(n + 1).padStart(2, '0')}.png`), rgbPng(img.pixels, img.width, img.height));
  });
  console.log(`${dir}: ${files.length} görüntü (${W}x${H})`);
}
