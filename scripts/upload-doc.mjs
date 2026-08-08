#!/usr/bin/env node
/**
 * Upload a standalone HTML document to the `legal` storage bucket.
 *
 * The point of keeping these in storage rather than in `public/` is that correcting a typo in the
 * help guide should not require a deploy. Re-run this with the same slug and the new file is live
 * on the next request.
 *
 *   node scripts/upload-doc.mjs help "~/Downloads/ShareCircle Help Guide.html"
 *
 * Slugs map to `/api/docs/<slug>`, which is what the app links to.
 */

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const BUCKET = 'legal';
const SLUG_TO_OBJECT = {
	help: 'sharecircle_help.html',
	terms: 'sharecircle_terms.html',
	privacy: 'sharecircle_privacy.html',
};

const [slug, filePath] = process.argv.slice(2);

if (!slug || !filePath) {
	console.error('Usage: node scripts/upload-doc.mjs <help|terms|privacy> <path-to-html>');
	process.exit(1);
}

const objectName = SLUG_TO_OBJECT[slug];
if (!objectName) {
	console.error(`Unknown slug "${slug}". Expected one of: ${Object.keys(SLUG_TO_OBJECT).join(', ')}`);
	process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
	console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
	process.exit(1);
}

const html = readFileSync(filePath);

// A document that is not self-contained would render without styling or images once it is served
// from storage rather than from the site, and nothing would report that — it would simply look
// broken. Refuse rather than upload something that cannot work.
const text = html.toString('utf8');
const externalRefs = [...text.matchAll(/(?:src|href)="(https?:\/\/[^"]+)"/g)].map(match => match[1]);
if (externalRefs.length > 0) {
	console.error(
		`Refusing to upload: the document references ${externalRefs.length} external URL(s), which will not be` +
			` available from storage. First: ${externalRefs[0]}`,
	);
	process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

const { error } = await supabase.storage.from(BUCKET).upload(objectName, html, {
	contentType: 'text/html; charset=utf-8',
	upsert: true,
});

if (error) {
	console.error(`Upload failed: ${error.message}`);
	process.exit(1);
}

console.log(`Uploaded ${filePath}`);
console.log(`  -> ${BUCKET}/${objectName}  (${(html.length / 1024).toFixed(0)} KB)`);
console.log(`  served at /api/docs/${slug}`);
