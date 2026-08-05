import { describe, expect, it } from 'vitest';
import { INVITE_EXPIRY_DAYS, formatInviteExpiry, getInviteExpiryDate, isInviteExpired } from '@/lib/invite';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('getInviteExpiryDate', () => {
	it('is exactly INVITE_EXPIRY_DAYS ahead of the supplied instant', () => {
		const now = Date.UTC(2026, 6, 31, 12, 0, 0);
		expect(getInviteExpiryDate(now).getTime()).toBe(now + INVITE_EXPIRY_DAYS * DAY_MS);
	});

	it('is 2 days, not 30', () => {
		// A link that grants circle membership should be short-lived.
		expect(INVITE_EXPIRY_DAYS).toBe(2);
	});

	it('uses epoch arithmetic, so a DST boundary cannot shift it', () => {
		// setDate(getDate() + n) is local-calendar arithmetic and drifts by an hour across a
		// DST transition. Two instants an equal distance apart must yield equal offsets.
		const beforeSpringForward = Date.UTC(2026, 2, 7, 12, 0, 0);
		const midSummer = Date.UTC(2026, 6, 7, 12, 0, 0);

		const offsetA = getInviteExpiryDate(beforeSpringForward).getTime() - beforeSpringForward;
		const offsetB = getInviteExpiryDate(midSummer).getTime() - midSummer;

		expect(offsetA).toBe(offsetB);
	});
});

describe('isInviteExpired', () => {
	const now = Date.UTC(2026, 6, 31, 12, 0, 0);

	it('is false for a freshly minted invite', () => {
		// The reported bug: a just-created link reading as invalid.
		expect(isInviteExpired(getInviteExpiryDate(now), now)).toBe(false);
	});

	it('is true once the instant has passed', () => {
		expect(isInviteExpired(new Date(now - 1), now)).toBe(true);
	});

	it('treats the exact expiry instant as expired', () => {
		expect(isInviteExpired(new Date(now), now)).toBe(true);
	});

	it('accepts an ISO string as well as a Date', () => {
		// The API serialises to JSON, so the client compares strings.
		expect(isInviteExpired(new Date(now + DAY_MS).toISOString(), now)).toBe(false);
		expect(isInviteExpired(new Date(now - DAY_MS).toISOString(), now)).toBe(true);
	});

	it('does not treat a missing or unparseable expiry as expired', () => {
		// Failing open here is deliberate: a null column must not lock everyone out of a
		// circle. The DB default guarantees a real value in practice.
		expect(isInviteExpired(null, now)).toBe(false);
		expect(isInviteExpired(undefined, now)).toBe(false);
		expect(isInviteExpired('not-a-date', now)).toBe(false);
	});
});

describe('formatInviteExpiry', () => {
	it('names the expiry instant', () => {
		const label = formatInviteExpiry(new Date(Date.UTC(2026, 7, 2, 15, 45, 0)));
		expect(label).toMatch(/Invite expires on/);
		expect(label).toMatch(/2026/);
	});

	it('includes a time, so a 2-day window is unambiguous', () => {
		const label = formatInviteExpiry(new Date(Date.UTC(2026, 7, 2, 15, 45, 0)));
		expect(label).toMatch(/\d{1,2}:\d{2}/);
	});

	it('states the window when there is no expiry, using the shared constant', () => {
		// Three separate UI strings used to hardcode "7 days" while the code said 30.
		expect(formatInviteExpiry(null)).toContain(`${INVITE_EXPIRY_DAYS} days`);
		expect(formatInviteExpiry(undefined)).toContain(`${INVITE_EXPIRY_DAYS} days`);
		expect(formatInviteExpiry('garbage')).toContain(`${INVITE_EXPIRY_DAYS} days`);
	});
});
