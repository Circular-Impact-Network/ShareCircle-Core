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
			return NextResponse.json({ error: 'Document unavailable' }, { status: 502 });
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
		return NextResponse.json({ error: 'Document unavailable' }, { status: 502 });
	}
}
