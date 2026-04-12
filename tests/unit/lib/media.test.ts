import { describe, it, expect } from 'vitest';
import {
	MAX_UPLOAD_SIZE_BYTES,
	MAX_MEDIA_ATTACHMENTS,
	SUPPORTED_IMAGE_TYPES,
	SUPPORTED_MEDIA_TYPES,
	getUploadValidationError,
	isHeicLikeType,
} from '@/lib/media';

function createFile(name: string, size: number, type: string): File {
	const buffer = new ArrayBuffer(size);
	return new File([buffer], name, { type });
}

describe('media utilities', () => {
	describe('constants', () => {
		it('MAX_UPLOAD_SIZE_BYTES is 5MB', () => {
			expect(MAX_UPLOAD_SIZE_BYTES).toBe(5 * 1024 * 1024);
		});

		it('MAX_MEDIA_ATTACHMENTS is 5', () => {
			expect(MAX_MEDIA_ATTACHMENTS).toBe(5);
		});

		it('supports standard image types', () => {
			expect(SUPPORTED_IMAGE_TYPES).toContain('image/jpeg');
			expect(SUPPORTED_IMAGE_TYPES).toContain('image/png');
			expect(SUPPORTED_IMAGE_TYPES).toContain('image/webp');
		});

		it('media types include video formats', () => {
			expect(SUPPORTED_MEDIA_TYPES).toContain('video/mp4');
			expect(SUPPORTED_MEDIA_TYPES).toContain('video/webm');
		});
	});

	describe('isHeicLikeType', () => {
		it('returns true for HEIC files', () => {
			const file = createFile('photo.heic', 1000, 'image/heic');
			expect(isHeicLikeType(file)).toBe(true);
		});

		it('returns false for JPEG files', () => {
			const file = createFile('photo.jpg', 1000, 'image/jpeg');
			expect(isHeicLikeType(file)).toBe(false);
		});
	});

	describe('getUploadValidationError', () => {
		it('returns null for valid JPEG under size limit', () => {
			const file = createFile('photo.jpg', 1000, 'image/jpeg');
			expect(getUploadValidationError(file)).toBeNull();
		});

		it('returns error for HEIC file', () => {
			const file = createFile('photo.heic', 1000, 'image/heic');
			const error = getUploadValidationError(file);
			expect(error).toContain('not supported');
		});

		it('returns error for unsupported type', () => {
			const file = createFile('file.pdf', 1000, 'application/pdf');
			const error = getUploadValidationError(file);
			expect(error).toBeTruthy();
		});

		it('returns error for oversized file', () => {
			const file = createFile('big.jpg', MAX_UPLOAD_SIZE_BYTES + 1, 'image/jpeg');
			const error = getUploadValidationError(file);
			expect(error).toContain('smaller than');
		});

		it('allows video when allowVideo is true', () => {
			const file = createFile('video.mp4', 1000, 'video/mp4');
			expect(getUploadValidationError(file, { allowVideo: true })).toBeNull();
		});

		it('rejects video when allowVideo is false', () => {
			const file = createFile('video.mp4', 1000, 'video/mp4');
			expect(getUploadValidationError(file)).toBeTruthy();
		});

		it('respects custom maxSizeBytes', () => {
			const file = createFile('photo.jpg', 2000, 'image/jpeg');
			expect(getUploadValidationError(file, { maxSizeBytes: 1000 })).toContain('smaller than');
			expect(getUploadValidationError(file, { maxSizeBytes: 3000 })).toBeNull();
		});
	});
});
