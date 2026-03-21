import { describe, it, expect } from 'vitest';
import { computeEffectiveChannels } from '@/lib/notification-preferences';

function row(
	partial: Partial<{
		globalInApp: boolean;
		globalPush: boolean;
		categoryOverrides: unknown;
		typeOverrides: unknown;
	}>,
) {
	return {
		globalInApp: true,
		globalPush: true,
		categoryOverrides: {},
		typeOverrides: {},
		...partial,
	} as Parameters<typeof computeEffectiveChannels>[0];
}

describe('computeEffectiveChannels', () => {
	it('defaults all on when no overrides', () => {
		const r = row({});
		expect(computeEffectiveChannels(r, 'NEW_MESSAGE')).toEqual({ inApp: true, push: true });
	});

	it('disables in-app when global in-app is false', () => {
		const r = row({ globalInApp: false });
		expect(computeEffectiveChannels(r, 'NEW_MESSAGE')).toEqual({ inApp: false, push: true });
	});

	it('disables push when global push is false', () => {
		const r = row({ globalPush: false });
		expect(computeEffectiveChannels(r, 'NEW_MESSAGE')).toEqual({ inApp: true, push: false });
	});

	it('disables in-app for type in category when category inApp is false', () => {
		const r = row({
			categoryOverrides: { MESSAGES: { inApp: false } },
		});
		expect(computeEffectiveChannels(r, 'NEW_MESSAGE')).toEqual({ inApp: false, push: true });
	});

	it('still allows other categories when one category in-app is off', () => {
		const r = row({
			categoryOverrides: { MESSAGES: { inApp: false } },
		});
		expect(computeEffectiveChannels(r, 'BORROW_REQUEST_RECEIVED')).toEqual({ inApp: true, push: true });
	});

	it('disables type when type override inApp is false', () => {
		const r = row({
			typeOverrides: { NEW_MESSAGE: { inApp: false } },
		});
		expect(computeEffectiveChannels(r, 'NEW_MESSAGE')).toEqual({ inApp: false, push: true });
	});

	it('requires all layers for push on BORROW_REQUEST_RECEIVED', () => {
		const r = row({
			globalPush: true,
			categoryOverrides: { BORROW_REQUESTS: { push: false } },
		});
		expect(computeEffectiveChannels(r, 'BORROW_REQUEST_APPROVED')).toEqual({ inApp: true, push: false });
	});
});
