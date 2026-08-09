'use client';

/**
 * When it is reasonable to ask this device for notification permission.
 *
 * Kept apart from the component so the policy can be tested directly. The rules exist because a
 * permission prompt is a one-shot resource: a browser that has been dismissed enough times stops
 * showing the native dialog at all, and a user who is asked on every visit learns to dismiss
 * reflexively. Asking rarely is what keeps asking effective.
 */

const STORAGE_KEY = 'sharecircle_push_prompt';

/** Long enough that a decline is respected, short enough that a change of mind is caught. */
export const REASK_AFTER_DAYS = 14;
export const MAX_ASKS = 3;

export type PushPromptRecord = {
	/** Epoch ms of the last time the prompt was shown. */
	lastShownAt?: number;
	asks?: number;
	/** Set when the user explicitly opts out; nothing re-asks after this. */
	declinedForever?: boolean;
};

export function readPromptRecord(): PushPromptRecord {
	if (typeof window === 'undefined') {
		return {};
	}
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		return raw ? (JSON.parse(raw) as PushPromptRecord) : {};
	} catch {
		// Private-browsing modes throw on access. Treat it as "never asked": the worst case is one
		// prompt per session, which is better than never being able to enable push at all.
		return {};
	}
}

export function writePromptRecord(record: PushPromptRecord): void {
	try {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
	} catch {
		// Nothing to do — the cap simply will not persist in this browser.
	}
}

type ShouldAskInput = {
	/** Whether this browser has PushManager/Notification at all. */
	supported: boolean;
	permission: NotificationPermission | 'unsupported';
	/** Whether a subscription already exists for this device. */
	alreadyEnabled: boolean;
	record: PushPromptRecord;
	now: number;
};

/**
 * The prompt is deliberately per device rather than per account: a push subscription belongs to one
 * browser, so a user who enabled notifications on their laptop still needs to be asked on their
 * phone. Storing this per account would silence the second device forever.
 */
export function shouldAskForPush({ supported, permission, alreadyEnabled, record, now }: ShouldAskInput): boolean {
	if (!supported || alreadyEnabled) {
		return false;
	}

	// 'granted' without a subscription is handled by the provider's own sync, and 'denied' cannot be
	// reversed from a web page — only in browser settings — so asking again would be theatre.
	if (permission !== 'default') {
		return false;
	}

	if (record.declinedForever) {
		return false;
	}

	if ((record.asks ?? 0) >= MAX_ASKS) {
		return false;
	}

	if (record.lastShownAt && now - record.lastShownAt < REASK_AFTER_DAYS * 24 * 60 * 60 * 1000) {
		return false;
	}

	return true;
}
