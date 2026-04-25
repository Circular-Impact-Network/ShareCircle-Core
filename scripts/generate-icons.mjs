// Run once: node scripts/generate-icons.mjs
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
// Square icon (already centered, RGBA transparency, logo fills the frame well)
const src = join(root, 'public', 'share-circle-icon-square.png');
const outDir = join(root, 'public', 'icons');

mkdirSync(outDir, { recursive: true });

const sizes = [192, 512];

// 'any' icons — transparent background so the OS renders it in its own context
for (const size of sizes) {
	await sharp(src)
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
	await sharp(src)
		.resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
		.extend({ top: pad, bottom: pad, left: pad, right: pad, background: appBg })
		.flatten({ background: appBg })
		.png()
		.toFile(join(outDir, `icon-maskable-${size}.png`));
	console.log(`Generated icon-maskable-${size}.png (maskable)`);
}

console.log('Done. Uninstall and reinstall the PWA to pick up the updated icons.');
