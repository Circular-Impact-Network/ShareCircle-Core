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

const text = html.toString('utf8');

/*
 * These documents are served under a deliberately strict CSP (see `next.config.ts`): no script, no
 * network, `sandbox`. Two checks, for two different reasons.
 *
 * Script is refused outright. A document in this bucket can be replaced by an upload with no code
 * review, and it is served from our own origin — so a script in one would run with the reader's
 * session. The CSP already blocks it; refusing here as well means a mistake is caught by the person
 * making it rather than showing up as a silent console error on a legal page.
 *
 * Anything else external is only warned about. The earlier version of this refused every external
 * URL on the grounds that it "will not be available from storage", which is simply wrong — the
 * browser fetches it perfectly well. What actually decides is whether the CSP permits the host, so
 * the warning names the URLs and lets the operator check rather than blocking a valid upload. This
 * is what stopped the real terms and privacy documents, which use Google Fonts, from being uploaded.
 */
const scriptRefs = [...text.matchAll(/<script\b[^>]*>/gi)].map(match => match[0]);
if (scriptRefs.length > 0) {
	console.error(
		`Refusing to upload: the document contains ${scriptRefs.length} <script> tag(s). These documents are` +
			` served from our own origin under a no-script CSP. First: ${scriptRefs[0].slice(0, 120)}`,
	);
	process.exit(1);
}

const externalRefs = [
	...new Set([...text.matchAll(/(?:src|href)="(https?:\/\/[^"]+)"/g)].map(m => new URL(m[1]).host)),
];
if (externalRefs.length > 0) {
	console.warn(`Note: references external host(s): ${externalRefs.join(', ')}`);
	console.warn('      These load only if the document CSP in next.config.ts allows them.');
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
