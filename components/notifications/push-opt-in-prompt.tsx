'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bell, Share, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNotificationsContext } from '@/components/providers/notifications-provider';
import { isIosBrowser, isPushSupported, isStandaloneDisplayMode } from '@/lib/push-client';
import { readPromptRecord, shouldAskForPush, writePromptRecord } from '@/lib/push-prompt';

type PushOptInPromptProps = {
	/**
	 * Held false while the guided tour is running. Two overlays competing for a new user's attention
	 * on their first visit is worse than either alone, so the tour finishes first.
	 */
	ready: boolean;
};

/**
 * Asks this device for notification permission, once, at a moment the user can understand.
 *
 * Account-level notification preferences already default to on, so the only thing standing between
 * a user and their alerts is the browser permission — and nothing ever asked for it. Every account
 * therefore had notifications "enabled" and no device subscribed to receive them.
 *
 * It cannot be granted silently: `Notification.requestPermission()` needs a real user gesture, and
 * on iOS the API does not exist at all until the app is installed to the Home Screen.
 */
export function PushOptInPrompt({ ready }: PushOptInPromptProps) {
	const notifications = useNotificationsContext();
	const [dismissed, setDismissed] = useState(false);
	// Captured once on mount. Reading the clock during render is impure, and the cooldown is measured
	// in days — the difference between "now" and "when this screen opened" cannot matter here.
	const [mountedAt] = useState(() => Date.now());

	const pushEnabled = notifications?.pushEnabled ?? false;
	const pushPermission = notifications?.pushPermission ?? 'unsupported';
	const pushLoading = notifications?.pushLoading ?? false;

	/**
	 * Derived during render rather than pushed into state from an effect, which would render once
	 * to decide and again to show. `ready` is false on the first render, so this reads nothing from
	 * the browser until after hydration and cannot cause a server/client mismatch.
	 *
	 * 'install' is the iOS case: Safari has no PushManager until the app is on the Home Screen, so
	 * the honest thing to show is the instruction rather than a button that cannot work.
	 */
	const decision: 'hidden' | 'ask' | 'install' = useMemo(() => {
		if (!ready || dismissed || typeof window === 'undefined') {
			return 'hidden';
		}

		const record = readPromptRecord();

		if (!isPushSupported()) {
			const iosNotInstalled = isIosBrowser() && !isStandaloneDisplayMode();
			// Shown at most once: it is advice, not a request, and repeating advice is nagging.
			return iosNotInstalled && !record.declinedForever && (record.asks ?? 0) < 1 ? 'install' : 'hidden';
		}

		return shouldAskForPush({
			supported: true,
			permission: pushPermission,
			alreadyEnabled: pushEnabled,
			record,
			now: mountedAt,
		})
			? 'ask'
			: 'hidden';
	}, [ready, dismissed, pushEnabled, pushPermission, mountedAt]);

	// Counted once it is actually on screen, rather than when it merely becomes eligible.
	useEffect(() => {
		if (decision === 'hidden') {
			return;
		}
		const record = readPromptRecord();
		writePromptRecord({ ...record, lastShownAt: Date.now(), asks: (record.asks ?? 0) + 1 });
	}, [decision]);

	if (decision === 'hidden') {
		return null;
	}

	const needsInstall = decision === 'install';

	const dismiss = (forever: boolean) => {
		if (forever) {
			writePromptRecord({ ...readPromptRecord(), declinedForever: true });
		}
		setDismissed(true);
	};

	return (
		<div
			data-testid="push-opt-in-prompt"
			role="dialog"
			aria-labelledby="push-opt-in-title"
			className="fixed inset-x-3 bottom-[calc(var(--bottom-nav-height,4rem)+0.75rem)] z-50 mx-auto max-w-md rounded-xl border border-border bg-card p-4 shadow-lg lg:inset-x-auto lg:right-6 lg:bottom-6 lg:mx-0"
		>
			<div className="flex items-start gap-3">
				<div className="mt-0.5 rounded-full bg-primary/10 p-2 text-primary">
					{needsInstall ? <Share className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
				</div>
				<div className="min-w-0 flex-1 space-y-1">
					<p id="push-opt-in-title" className="text-sm font-medium">
						{needsInstall ? 'Install ShareCircle for alerts' : 'Get notified about your items'}
					</p>
					<p className="text-sm text-muted-foreground">
						{needsInstall
							? 'On iPhone and iPad, notifications need the app on your Home Screen. Tap Share, then "Add to Home Screen".'
							: 'Borrow requests, messages and returns, even when the app is closed.'}
					</p>
				</div>
				<button
					type="button"
					onClick={() => dismiss(false)}
					aria-label="Dismiss"
					className="-mr-1 -mt-1 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
				>
					<X className="h-4 w-4" />
				</button>
			</div>

			{!needsInstall && (
				<div className="mt-3 flex items-center justify-end gap-2">
					<Button variant="ghost" size="sm" onClick={() => dismiss(true)} data-testid="push-opt-in-decline">
						Not now
					</Button>
					<Button
						size="sm"
						disabled={pushLoading}
						data-testid="push-opt-in-enable"
						onClick={() => {
							// Called straight from the click. Safari only shows the permission dialog while
							// the originating tap still counts as user activation, and awaiting anything
							// first spends it — the bug that left the Settings toggle dead.
							void notifications?.enablePushNotifications().finally(() => setDismissed(true));
						}}
					>
						{pushLoading ? 'Enabling…' : 'Turn on'}
					</Button>
				</div>
			)}
		</div>
	);
}
