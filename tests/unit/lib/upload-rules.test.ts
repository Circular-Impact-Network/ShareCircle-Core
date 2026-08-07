import { describe, expect, it } from 'vitest';

import { getUploadValidationError } from '@/lib/media';
import { MAX_UPLOAD_BYTES, isHeicLike, isSupportedUploadType, unsupportedTypeMessage } from '@/lib/upload-rules';

function fakeFile(type: string, size: number): File {
	return { type, size } as File;
}

/**
 * These assert the *agreement* between client and server, which is the thing that was broken.
 * Before lib/upload-rules existed, the client rejected HEIC and capped at 5MB while the item
 * upload route accepted HEIC and allowed 10MB — so an iPhone photo produced a client-side error
 * for a payload the API would have taken.
 */
describe('upload rules', () => {
	it('rejects HEIC consistently', () => {
		expect(isHeicLike('image/heic')).toBe(true);
		expect(isHeicLike('image/heif')).toBe(true);
		// The client validator must agree with the shared predicate.
		expect(getUploadValidationError(fakeFile('image/heic', 1000))).toBeTruthy();
	});

	it('accepts the four supported image types on both sides', () => {
		for (const type of ['image/jpeg', 'image/png', 'image/gif', 'image/webp']) {
			expect(isSupportedUploadType(type)).toBe(true);
			expect(getUploadValidationError(fakeFile(type, 1000))).toBeNull();
		}
	});

	it('only allows video when the caller opts in', () => {
		expect(isSupportedUploadType('video/mp4')).toBe(false);
		expect(isSupportedUploadType('video/mp4', { allowVideo: true })).toBe(true);
	});

	it('uses one size cap, so a file the client accepts is one the API accepts', () => {
		const justUnder = fakeFile('image/jpeg', MAX_UPLOAD_BYTES - 1);
		const justOver = fakeFile('image/jpeg', MAX_UPLOAD_BYTES + 1);
		expect(getUploadValidationError(justUnder)).toBeNull();
		expect(getUploadValidationError(justOver)).toContain('smaller than');
	});

	it('accepts a 6MB photo, which the old 5MB client cap refused', () => {
		expect(getUploadValidationError(fakeFile('image/jpeg', 6 * 1024 * 1024))).toBeNull();
	});

	it('describes the allowed types differently with and without video', () => {
		expect(unsupportedTypeMessage()).not.toContain('MP4');
		expect(unsupportedTypeMessage({ allowVideo: true })).toContain('MP4');
	});
});
