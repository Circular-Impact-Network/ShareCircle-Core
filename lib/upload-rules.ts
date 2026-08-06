/**
 * One definition of what may be uploaded.
 *
 * These rules previously existed in three places with three different answers:
 *
 *   lib/media.ts (client)              jpeg/png/gif/webp, HEIC explicitly rejected,  5 MB
 *   app/api/upload/image/route.ts      jpeg/png/gif/webp + heic/heif,               10 MB
 *   app/api/circles/[id]/avatar/route  jpeg/png/gif/webp,                            5 MB
 *
 * The user-visible consequence was that an iPhone shooting in its default HEIC format got a
 * client-side "switch Camera to Most Compatible" message for a payload the item-upload API would
 * have accepted, and a 6 MB photo was refused by the client while the API allowed 10 MB. Exactly
 * the client/server divergence that lib/password-validation.ts was created to end — the rule was
 * simply restated per call site instead of shared.
 *
 * Deliberately isomorphic: no 'use client', no server-only imports, so both sides consume the
 * same module and cannot drift again.
 */

const MB = 1024 * 1024;

/**
 * Ten megabytes, matching what the item-upload route already accepted. The server re-encodes with
 * sharp and the client compresses before sending, so the cap governs the original file, and the
 * lower 5 MB client limit was rejecting ordinary phone photos for no reason.
 */
export const MAX_UPLOAD_BYTES = 10 * MB;

export const MAX_MEDIA_ATTACHMENTS = 5;

export const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;

export const SUPPORTED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'] as const;

/**
 * HEIC/HEIF stay unsupported, and now *consistently* so.
 *
 * The server used to accept them, but every UI path blocked them first, so no real user ever
 * exercised that path — accepting them server-side bought nothing while making the contract a
 * lie. Supporting HEIC properly means verifying libvips is built with HEIF in every deployment
 * target; that is a feature, not this fix.
 */
export const UNSUPPORTED_IMAGE_TYPES = [
	'image/heic',
	'image/heif',
	'image/heic-sequence',
	'image/heif-sequence',
] as const;

export function isHeicLike(mimeType: string): boolean {
	return (UNSUPPORTED_IMAGE_TYPES as readonly string[]).includes(mimeType);
}

export function isSupportedUploadType(mimeType: string, { allowVideo = false } = {}): boolean {
	const allowed: readonly string[] = allowVideo
		? [...SUPPORTED_IMAGE_TYPES, ...SUPPORTED_VIDEO_TYPES]
		: SUPPORTED_IMAGE_TYPES;
	return allowed.includes(mimeType);
}

export function formatMaxUploadSize(bytes: number = MAX_UPLOAD_BYTES): string {
	return `${Math.round(bytes / MB)}MB`;
}

export const HEIC_MESSAGE =
	'This photo format is not supported yet. On iPhone, switch Camera to Most Compatible or choose a JPEG/PNG/WebP image.';

export function unsupportedTypeMessage({ allowVideo = false } = {}): string {
	return allowVideo
		? 'Only JPEG, PNG, GIF, WebP, MP4, WebM, or QuickTime files are supported.'
		: 'Only JPEG, PNG, GIF, and WebP images are supported.';
}
