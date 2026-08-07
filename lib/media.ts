'use client';

import {
	HEIC_MESSAGE,
	MAX_MEDIA_ATTACHMENTS as SHARED_MAX_MEDIA_ATTACHMENTS,
	MAX_UPLOAD_BYTES,
	SUPPORTED_IMAGE_TYPES as SHARED_SUPPORTED_IMAGE_TYPES,
	SUPPORTED_VIDEO_TYPES,
	UNSUPPORTED_IMAGE_TYPES,
	formatMaxUploadSize,
	isHeicLike,
	isSupportedUploadType,
	unsupportedTypeMessage,
} from '@/lib/upload-rules';

// Re-exported so existing importers keep working, but the values now come from lib/upload-rules
// so the client and the two upload routes cannot disagree about them again.
export const MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_BYTES;
export const MAX_MEDIA_ATTACHMENTS = SHARED_MAX_MEDIA_ATTACHMENTS;

export const SUPPORTED_IMAGE_TYPES = SHARED_SUPPORTED_IMAGE_TYPES;
export const SUPPORTED_MEDIA_TYPES = [...SHARED_SUPPORTED_IMAGE_TYPES, ...SUPPORTED_VIDEO_TYPES] as const;
export const IOS_UNSUPPORTED_IMAGE_TYPES = UNSUPPORTED_IMAGE_TYPES;

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
	return isHeicLike(file.type);
}

export function getUploadValidationError(
	file: File,
	{ allowVideo = false, maxSizeBytes = MAX_UPLOAD_SIZE_BYTES }: ValidateFileOptions = {},
) {
	if (isHeicLikeType(file)) {
		return HEIC_MESSAGE;
	}

	if (!isSupportedUploadType(file.type, { allowVideo })) {
		return unsupportedTypeMessage({ allowVideo });
	}

	if (file.size > maxSizeBytes) {
		return `Each file must be smaller than ${formatMaxUploadSize(maxSizeBytes)}.`;
	}

	return null;
}

export async function prepareImageForUpload(
	file: File,
	{ maxSizeBytes = MAX_UPLOAD_SIZE_BYTES, maxDimension = 2048, quality = 0.86 }: CompressionOptions = {},
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
