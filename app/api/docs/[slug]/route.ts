import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * Serves the standalone documents (help guide, terms, privacy) out of Supabase storage.
 *
 * They are proxied rather than linked directly for two reasons. The documents can then be corrected
 * by re-uploading a file instead of by shipping a deploy, which is the whole point of moving them
 * out of `public/`; and a route handler is the only place this host will apply our headers at all —
 * files served from `public/` bypass `next.config.ts` `headers()` entirely on Hostinger, so a
 * static copy would carry neither `nosniff` nor a CSP.
 *
 * Deliberately unauthenticated: the terms and privacy policy have to be readable by someone
 * deciding whether to sign up, and the help guide describes the product rather than any user's data.
 */

const SLUG_TO_OBJECT: Record<string, string> = {
	help: 'sharecircle_help.html',
	terms: 'sharecircle_terms.html',
	privacy: 'sharecircle_privacy.html',
};

const BUCKET = 'legal';

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
	const { slug } = await params;
	const objectName = SLUG_TO_OBJECT[slug];

	// An allow-list, not a pass-through: `slug` is user-controlled, and interpolating it into a
	// storage path would let a request walk the bucket.
	if (!objectName) {
		return NextResponse.json({ error: 'Not found' }, { status: 404 });
	}

	try {
		const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(objectName);

		if (error || !data) {
			console.error(`Failed to read ${BUCKET}/${objectName}:`, error);
			return unavailable(slug);
		}

		return new NextResponse(await data.arrayBuffer(), {
			status: 200,
			headers: {
				'Content-Type': 'text/html; charset=utf-8',
				'X-Content-Type-Options': 'nosniff',
				// These are rendered inside a sandboxed iframe, but the document is also reachable
				// directly. A CSP of its own means an uploaded file cannot execute script or call out,
				// wherever it ends up being opened.
				'Content-Security-Policy':
					"default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; font-src data:; sandbox",
				// Short enough that a re-upload is visible in minutes, long enough that a 1.4 MB
				// document is not re-fetched on every navigation.
				'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
			},
		});
	} catch (error) {
		console.error(`Failed to serve document "${slug}":`, error);
		return unavailable(slug);
	}
}

/**
 * A readable page rather than a JSON error.
 *
 * These URLs are reached by people, not by code: `/terms` and `/privacy` are linked from the signup
 * form and from emails. A raw `{"error":...}` body on a legal page tells a visitor nothing and looks
 * like the site is broken. This says what happened and offers a way to get the document.
 */
function unavailable(slug: string) {
	const title = slug === 'terms' ? 'Terms of Service' : slug === 'privacy' ? 'Privacy Policy' : 'Help Guide';

	return new NextResponse(
		`<!doctype html><html lang="en"><head><meta charset="utf-8">` +
			`<meta name="viewport" content="width=device-width,initial-scale=1">` +
			`<title>${title} — temporarily unavailable</title>` +
			`<style>body{font:16px/1.6 system-ui,sans-serif;margin:0;display:grid;place-items:center;` +
			`min-height:100vh;padding:1.5rem;color:#1f2937}main{max-width:32rem;text-align:center}` +
			`h1{font-size:1.25rem;margin:0 0 .5rem}p{margin:.5rem 0;color:#4b5563}` +
			`a{color:#047857}</style></head><body><main>` +
			`<h1>${title} is temporarily unavailable</h1>` +
			`<p>We could not load this document just now. Please try again shortly.</p>` +
			`<p>If you need it urgently, email ` +
			`<a href="mailto:support@circularimpact.org">support@circularimpact.org</a>.</p>` +
			`</main></body></html>`,
		{
			// 503, not 502: this is a retryable outage of one document, and it tells a crawler not to
			// treat the absence as permanent.
			status: 503,
			headers: {
				'Content-Type': 'text/html; charset=utf-8',
				'Cache-Control': 'no-store',
			},
		},
	);
}
