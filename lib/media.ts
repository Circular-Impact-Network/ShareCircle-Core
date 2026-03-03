'use client';

const MB = 1024 * 1024;

export const MAX_UPLOAD_SIZE_BYTES = 5 * MB;
export const MAX_MEDIA_ATTACHMENTS = 5;

export const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;
export const SUPPORTED_MEDIA_TYPES = [
	...SUPPORTED_IMAGE_TYPES,
	'video/mp4',
	'video/webm',
	'video/quicktime',
] as const;
export const IOS_UNSUPPORTED_IMAGE_TYPES = [
	'image/heic',
	'image/heif',
	'image/heic-sequence',
	'image/heif-sequence',
] as const;

type ValidateFileOptions = {
	allowVideo?: boolean;
	maxSizeBytes?: number;
};

type CompressionOptions = {
	maxSizeBytes?: number;
	maxDimension?: number;
	quality?: number;
};

export function isHeicLikeType(file: File) {
	return IOS_UNSUPPORTED_IMAGE_TYPES.includes(file.type as (typeof IOS_UNSUPPORTED_IMAGE_TYPES)[number]);
}

export function getUploadValidationError(
	file: File,
	{ allowVideo = false, maxSizeBytes = MAX_UPLOAD_SIZE_BYTES }: ValidateFileOptions = {},
) {
	const supportedTypes = new Set<string>(allowVideo ? SUPPORTED_MEDIA_TYPES : SUPPORTED_IMAGE_TYPES);

	if (isHeicLikeType(file)) {
		return 'This photo format is not supported yet. On iPhone, switch Camera to Most Compatible or choose a JPEG/PNG/WebP image.';
	}

	if (!supportedTypes.has(file.type)) {
		return allowVideo
			? 'Only JPEG, PNG, GIF, WebP, MP4, WebM, or QuickTime files are supported.'
			: 'Only JPEG, PNG, GIF, and WebP images are supported.';
	}

	if (file.size > maxSizeBytes) {
		return `Each file must be smaller than ${Math.round(maxSizeBytes / MB)}MB.`;
	}

	return null;
}

export async function prepareImageForUpload(
	file: File,
	{
		maxSizeBytes = MAX_UPLOAD_SIZE_BYTES,
		maxDimension = 2048,
		quality = 0.86,
	}: CompressionOptions = {},
) {
	if (
		typeof window === 'undefined' ||
		!file.type.startsWith('image/') ||
		file.type === 'image/gif' ||
		isHeicLikeType(file)
	) {
		return file;
	}

	const bitmap = await createImageBitmap(file);
	const needsResize = Math.max(bitmap.width, bitmap.height) > maxDimension;
	const needsCompression = file.size > maxSizeBytes;

	if (!needsResize && !needsCompression) {
		bitmap.close();
		return file;
	}

	const scale = needsResize ? maxDimension / Math.max(bitmap.width, bitmap.height) : 1;
	const width = Math.max(1, Math.round(bitmap.width * scale));
	const height = Math.max(1, Math.round(bitmap.height * scale));
	const canvas = document.createElement('canvas');

	canvas.width = width;
	canvas.height = height;

	const context = canvas.getContext('2d');
	if (!context) {
		bitmap.close();
		return file;
	}

	context.drawImage(bitmap, 0, 0, width, height);
	bitmap.close();

	const targetType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
	const blob = await new Promise<Blob | null>(resolve => {
		canvas.toBlob(resolve, targetType, targetType === 'image/jpeg' ? quality : undefined);
	});

	if (!blob) {
		return file;
	}

	const extension = targetType === 'image/png' ? 'png' : 'jpg';
	const baseName = file.name.replace(/\.[^.]+$/, '');

	return new File([blob], `${baseName}.${extension}`, {
		type: targetType,
		lastModified: Date.now(),
	});
}
