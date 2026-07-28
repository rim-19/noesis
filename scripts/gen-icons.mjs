// One-off: rasterize the Noesis flower into PWA PNG icons.
// Run with: node scripts/gen-icons.mjs
import sharp from "sharp";
import { writeFile } from "node:fs/promises";

const flower = (cx, cy, scale) => `
  <g transform="translate(${cx} ${cy}) scale(${scale}) translate(-32 -32)">
    <path d="M32 50 Q30 38 32 28" stroke="#3f6b4f" stroke-width="2.4" stroke-linecap="round" fill="none"/>
    <path d="M32 40 Q23 38 21 30 Q30 30 32 38" fill="#3f6b4f" opacity="0.7"/>
    <g fill="#b89ce6" opacity="0.55">
      <ellipse cx="32" cy="16.5" rx="4.9" ry="8.4" transform="rotate(36 32 22)"/>
      <ellipse cx="32" cy="16.5" rx="4.9" ry="8.4" transform="rotate(108 32 22)"/>
      <ellipse cx="32" cy="16.5" rx="4.9" ry="8.4" transform="rotate(180 32 22)"/>
      <ellipse cx="32" cy="16.5" rx="4.9" ry="8.4" transform="rotate(252 32 22)"/>
      <ellipse cx="32" cy="16.5" rx="4.9" ry="8.4" transform="rotate(324 32 22)"/>
    </g>
    <g fill="#e78fb3">
      <ellipse cx="32" cy="18" rx="4.6" ry="8"/>
      <ellipse cx="32" cy="18" rx="4.6" ry="8" transform="rotate(72 32 22)"/>
      <ellipse cx="32" cy="18" rx="4.6" ry="8" transform="rotate(144 32 22)"/>
      <ellipse cx="32" cy="18" rx="4.6" ry="8" transform="rotate(216 32 22)"/>
      <ellipse cx="32" cy="18" rx="4.6" ry="8" transform="rotate(288 32 22)"/>
    </g>
    <circle cx="32" cy="22" r="4.4" fill="#f2c464"/>
  </g>`;

// Rounded-rect icon (for "any" purpose + apple touch, which likes filled corners).
const rounded = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${size * 0.22}" fill="#161d2e"/>
  ${flower(size / 2, size / 2 + size * 0.03, size / 64 * 0.72)}
</svg>`;

// Maskable icon: full-bleed background, flower kept inside the ~80% safe zone.
const maskable = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#161d2e"/>
  <radialGradient id="g" cx="50%" cy="42%" r="55%">
    <stop offset="0%" stop-color="#1f2a40"/>
    <stop offset="100%" stop-color="#161d2e"/>
  </radialGradient>
  <rect width="${size}" height="${size}" fill="url(#g)"/>
  ${flower(size / 2, size / 2 + size * 0.02, size / 64 * 0.5)}
</svg>`;

const jobs = [
  ["icon-192.png", rounded(192)],
  ["icon-512.png", rounded(512)],
  ["icon-maskable-512.png", maskable(512)],
  ["apple-touch-icon.png", rounded(180)],
];

for (const [name, svg] of jobs) {
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  await writeFile(new URL(`../public/${name}`, import.meta.url), png);
  console.log("wrote public/" + name, png.length + "b");
}
