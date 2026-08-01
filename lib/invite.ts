/**
 * Circle invite expiry — shared by the API routes that mint invites and the UI that
 * describes them, so the number can never drift between the two again (it did: the code
 * said 30 days while three UI strings still said 7).
 *
 * Code generation lives in `lib/invite-server.ts` because it needs node:crypto and must
 * not be pulled into a client bundle.
 */

export const INVITE_EXPIRY_DAYS = 2;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Expiry as an absolute instant.
 *
 * Deliberately epoch arithmetic, not `d.setDate(d.getDate() + n)`: the latter is
 * local-calendar arithmetic and shifts by an hour whenever the window crosses a DST
 * boundary.
 */
export function getInviteExpiryDate(now: number = Date.now()): Date {
	return new Date(now + INVITE_EXPIRY_DAYS * DAY_MS);
}

export function isInviteExpired(expiresAt: Date | string | null | undefined, now: number = Date.now()): boolean {
	if (!expiresAt) {
		return false;
	}
	const expiryMs = expiresAt instanceof Date ? expiresAt.getTime() : new Date(expiresAt).getTime();
	if (!Number.isFinite(expiryMs)) {
		return false;
	}
	return expiryMs <= now;
}

/**
 * Human-readable expiry. Includes the time, not just the date: with a 2-day window a
 * bare date is ambiguous, and a date-only label rendered in the viewer's zone reads as
 * off-by-one for anyone behind UTC.
 */
export function formatInviteExpiry(expiresAt: Date | string | null | undefined): string {
	if (!expiresAt) {
		return `Invite expires ${INVITE_EXPIRY_DAYS} days after it is generated.`;
	}

	const date = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
	if (Number.isNaN(date.getTime())) {
		return `Invite expires ${INVITE_EXPIRY_DAYS} days after it is generated.`;
	}

	const formatted = new Intl.DateTimeFormat(undefined, {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
	}).format(date);

	return `Invite expires on ${formatted}.`;
}
