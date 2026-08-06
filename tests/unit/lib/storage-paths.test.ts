import { describe, expect, it } from 'vitest';

import { findForeignStoragePaths, isOwnedStoragePath } from '@/lib/storage-paths';

const ME = 'clu000000000000000000000';
const VICTIM = 'clv111111111111111111111';

describe('storage path ownership', () => {
	describe('isOwnedStoragePath', () => {
		it('accepts a key produced by uploadImage for this user', () => {
			// lib/supabase.ts builds `${userId}/${Date.now()}.${ext}`
			expect(isOwnedStoragePath(`${ME}/1754400000000.jpg`, ME)).toBe(true);
		});

		it("rejects another user's key", () => {
			expect(isOwnedStoragePath(`${VICTIM}/1754400000000.jpg`, ME)).toBe(false);
		});

		it('rejects a prefix that merely starts with the id but is a different folder', () => {
			expect(isOwnedStoragePath(`${ME}-other/file.jpg`, ME)).toBe(false);
		});

		it('rejects traversal', () => {
			expect(isOwnedStoragePath(`${ME}/../${VICTIM}/file.jpg`, ME)).toBe(false);
		});

		it('rejects an unprefixed key', () => {
			expect(isOwnedStoragePath('file.jpg', ME)).toBe(false);
		});

		it.each([
			['', ME],
			[`${ME}/a.jpg`, ''],
		])('rejects empty input (%j, %j)', (path, userId) => {
			expect(isOwnedStoragePath(path, userId)).toBe(false);
		});
	});

	describe('findForeignStoragePaths', () => {
		it('returns nothing when every path is owned', () => {
			expect(findForeignStoragePaths([`${ME}/a.jpg`, `${ME}/b.mp4`], ME)).toEqual([]);
		});

		it("names exactly the victim's paths, which is what the route 403s on", () => {
			const foreign = findForeignStoragePaths([`${ME}/a.jpg`, `${VICTIM}/secret.jpg`, `${ME}/b.jpg`], ME);
			expect(foreign).toEqual([`${VICTIM}/secret.jpg`]);
		});

		it('ignores null, undefined and empty entries rather than flagging them', () => {
			expect(findForeignStoragePaths([null, undefined, '', `${ME}/a.jpg`], ME)).toEqual([]);
		});

		it('blocks the delete exploit: adopting a victim path onto your own item', () => {
			// Step 1 of the chain was PATCH { mediaPaths: [victimPath] }.
			const foreign = findForeignStoragePaths([`${VICTIM}/holiday.jpg`], ME);
			expect(foreign).toHaveLength(1);
		});
	});
});
