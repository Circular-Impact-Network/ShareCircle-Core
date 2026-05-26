import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import sharp from 'sharp';
import { authOptions } from '@/lib/auth';
import { uploadImage, getSignedUrl } from '@/lib/supabase';
import { checkRateLimit, getClientIdentifier, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit';

// Allowed storage buckets (attachments for chat, media for item video)
const ALLOWED_BUCKETS = ['avatars', 'items', 'media', 'attachments'];

// Resize budget: anything above this is downscaled.
const MAX_EDGE = 1600;
const JPEG_QUALITY = 80;

async function compressImage(file: File): Promise<{ file: File; ext: 'jpg' | 'png' | 'webp' }> {
	const buffer = Buffer.from(await file.arrayBuffer());
	const pipeline = sharp(buffer, { failOn: 'none' }).rotate(); // EXIF auto-rotate

	const metadata = await pipeline.metadata();
	const maxDim = Math.max(metadata.width ?? 0, metadata.height ?? 0);
	if (maxDim > MAX_EDGE) {
		pipeline.resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true });
	}

	let ext: 'jpg' | 'png' | 'webp';
	let outBuffer: Buffer;
	if (file.type === 'image/png') {
		outBuffer = await pipeline.png({ compressionLevel: 9, palette: true }).toBuffer();
		ext = 'png';
	} else if (file.type === 'image/webp') {
		outBuffer = await pipeline.webp({ quality: JPEG_QUALITY }).toBuffer();
		ext = 'webp';
	} else {
		// JPEG / GIF (single-frame) / HEIC all get re-encoded as JPEG for max compatibility + small size.
		outBuffer = await pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer();
		ext = 'jpg';
	}

	// new Blob() doesn't accept Node Buffer in strict TS; convert to Uint8Array view.
	const blob = new Blob([new Uint8Array(outBuffer)], {
		type: ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg',
	});
	const compressedFile = new File([blob], file.name.replace(/\.[^.]+$/, `.${ext}`), { type: blob.type });
	return { file: compressedFile, ext };
}

export async function POST(req: NextRequest) {
	try {
		const session = await getServerSession(authOptions);

		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const identifier = getClientIdentifier(req, session.user.id);
		const rateLimitResult = checkRateLimit(identifier, 'upload-image', RATE_LIMITS.upload);
		if (!rateLimitResult.success) {
			return rateLimitResponse(rateLimitResult);
		}

		// Get bucket from query params (default to 'avatars')
		const bucket = req.nextUrl.searchParams.get('bucket') || 'avatars';

		// Validate bucket
		if (!ALLOWED_BUCKETS.includes(bucket)) {
			return NextResponse.json(
				{ error: `Invalid bucket. Allowed: ${ALLOWED_BUCKETS.join(', ')}` },
				{ status: 400 },
			);
		}

		const formData = await req.formData();
		const file = formData.get('file') as File;

		if (!file) {
			return NextResponse.json({ error: 'No file provided' }, { status: 400 });
		}

		// Validate file type
		// For 'media' bucket, allow images and videos. For other buckets, only images.
		const validImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif'];
		const validVideoTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
		const validTypes = bucket === 'media' ? [...validImageTypes, ...validVideoTypes] : validImageTypes;

		if (!validTypes.includes(file.type)) {
			const allowedTypes =
				bucket === 'media'
					? 'JPEG, PNG, GIF, WebP, HEIC, MP4, WebM, or QuickTime'
					: 'JPEG, PNG, GIF, WebP, or HEIC';
			return NextResponse.json(
				{ error: `Invalid file type. Only ${allowedTypes} are allowed.` },
				{ status: 400 },
			);
		}

		// Validate file size (max 10MB raw — sharp will compress images down to <500KB typically).
		const maxSize = 10 * 1024 * 1024;
		if (file.size > maxSize) {
			return NextResponse.json({ error: 'File size must be less than 10MB' }, { status: 400 });
		}

		// Compress images (skip videos — sharp doesn't handle them and they're not in this bucket anyway).
		const isImage = validImageTypes.includes(file.type);
		const uploadFile = isImage ? (await compressImage(file)).file : file;

		// Upload to Supabase and get file path
		const filePath = await uploadImage(uploadFile, bucket, session.user.id);

		// Generate signed URL for immediate use/preview
		const signedUrl = await getSignedUrl(filePath, bucket);

		return NextResponse.json(
			{
				path: filePath, // Store this in DB
				url: signedUrl, // Use for immediate preview
			},
			{ status: 200 },
		);
	} catch (error) {
		console.error('Image upload error:', error);
		return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
	}
}
