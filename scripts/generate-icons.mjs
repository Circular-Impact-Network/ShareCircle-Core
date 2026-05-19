/* global console */
// Run once: node scripts/generate-icons.mjs
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const src = join(root, 'public', 'logo_new_removeBg.png');
const outDir = join(root, 'public', 'icons');
const appDir = join(root, 'app');

mkdirSync(outDir, { recursive: true });

const sizes = [192, 512];

// Pre-trim the source to strip transparent border so the icon fills the canvas
const trimmed = await sharp(src).trim().toBuffer();

// 'any' icons — transparent background so the OS renders it in its own context
for (const size of sizes) {
	await sharp(trimmed)
		.resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
		.png()
		.toFile(join(outDir, `icon-${size}.png`));
	console.log(`Generated icon-${size}.png (any)`);
}

// 'maskable' icons — dark app background (#1a1d23) with 15% safe-zone padding so the
// icon stays fully visible when clipped to any shape (circle, squircle, etc.)
const appBg = { r: 26, g: 29, b: 35, alpha: 1 };
for (const size of sizes) {
	const pad = Math.round(size * 0.15);
	const inner = size - pad * 2;
	await sharp(trimmed)
		.resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
		.extend({ top: pad, bottom: pad, left: pad, right: pad, background: appBg })
		.flatten({ background: appBg })
		.png()
		.toFile(join(outDir, `icon-maskable-${size}.png`));
	console.log(`Generated icon-maskable-${size}.png (maskable)`);
}

// Browser favicon (tab icon) — transparent bg, 64×64
await sharp(trimmed)
	.resize(64, 64, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
	.png()
	.toFile(join(appDir, 'icon.png'));
console.log('Generated app/icon.png (favicon, 64×64)');

// Apple home screen icon — dark bg, 180×180
const appleSize = 180;
const applePad = Math.round(appleSize * 0.1);
const appleInner = appleSize - applePad * 2;
await sharp(trimmed)
	.resize(appleInner, appleInner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
	.extend({ top: applePad, bottom: applePad, left: applePad, right: applePad, background: appBg })
	.flatten({ background: appBg })
	.png()
	.toFile(join(appDir, 'apple-icon.png'));
console.log('Generated app/apple-icon.png (iOS home screen, 180×180)');

console.log('Done. Uninstall and reinstall the PWA to pick up the updated icons.');
