// Run once: node scripts/generate-icons.mjs
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const src = join(root, 'public', 'ShareCircleWhiteBgLogo.png');
const outDir = join(root, 'public', 'icons');

mkdirSync(outDir, { recursive: true });

const sizes = [192, 512];

for (const size of sizes) {
	await sharp(src)
		.resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
		.png()
		.toFile(join(outDir, `icon-${size}.png`));
	console.log(`Generated icon-${size}.png`);
}

console.log('Done. Uninstall and reinstall the PWA to see the updated icon.');
