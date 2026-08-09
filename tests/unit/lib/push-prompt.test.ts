import { describe, expect, it } from 'vitest';
import { MAX_ASKS, REASK_AFTER_DAYS, shouldAskForPush } from '@/lib/push-prompt';

const NOW = 1_770_000_000_000;
const DAY = 24 * 60 * 60 * 1000;

const base = {
	supported: true,
	permission: 'default' as NotificationPermission,
	alreadyEnabled: false,
	record: {},
	now: NOW,
};

describe('shouldAskForPush', () => {
	it('asks a supported browser that has never been asked', () => {
		expect(shouldAskForPush(base)).toBe(true);
	});

	it('never asks where push does not exist', () => {
		expect(shouldAskForPush({ ...base, supported: false })).toBe(false);
	});

	it('does not ask a device that is already subscribed', () => {
		expect(shouldAskForPush({ ...base, alreadyEnabled: true })).toBe(false);
	});

	// A page cannot reverse a denial — only browser settings can — so asking again is theatre.
	it('does not ask once permission was denied', () => {
		expect(shouldAskForPush({ ...base, permission: 'denied' })).toBe(false);
	});

	it('does not ask when permission was already granted', () => {
		expect(shouldAskForPush({ ...base, permission: 'granted' })).toBe(false);
	});

	it('respects an explicit opt-out for good', () => {
		expect(shouldAskForPush({ ...base, record: { declinedForever: true } })).toBe(false);
	});

	it('waits out the cooldown, then asks again', () => {
		const record = { lastShownAt: NOW - 1 * DAY, asks: 1 };
		expect(shouldAskForPush({ ...base, record })).toBe(false);
		expect(shouldAskForPush({ ...base, record, now: NOW + REASK_AFTER_DAYS * DAY })).toBe(true);
	});

	// Browsers stop showing the native dialog to a page that has been dismissed repeatedly, so the
	// cap protects the prompt's usefulness rather than merely being polite.
	it('stops after the maximum number of asks', () => {
		const record = { lastShownAt: NOW - 365 * DAY, asks: MAX_ASKS };
		expect(shouldAskForPush({ ...base, record })).toBe(false);
	});
});
