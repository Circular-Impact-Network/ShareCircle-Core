'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Bug, ChevronDown, Copy, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useNotificationsContext } from '@/components/providers/notifications-provider';
import { cn } from '@/lib/utils';

type DebugSubscription = {
	id: string;
	endpoint: string;
	endpointHost: string;
	userAgent: string | null;
	updatedAt: string;
};

type DebugAttempt = {
	id: string;
	endpointHost: string;
	success: boolean;
	statusCode: number | null;
	errorMessage: string | null;
	errorBody: string | null;
	payloadTag: string | null;
	purpose: string;
	createdAt: string;
	pushSubscriptionId: string | null;
};

type PushDebugResponse = {
	configured: boolean;
	computedStatus: string;
	subscriptions: DebugSubscription[];
	recentAttempts: DebugAttempt[];
	lastAttemptSummary: {
		success: boolean;
		statusCode: number | null;
		endpointHost: string;
		errorMessage: string | null;
		purpose: string;
		payloadTag: string | null;
		createdAt: string;
	} | null;
	effectiveChannelsByType?: Record<string, { inApp: boolean; push: boolean }>;
	messagePushHint?: string | null;
};

type TestPushSuccessResponse = {
	ok: true;
	message?: string;
	attempts: Array<{
		success: boolean;
		statusCode: number | null;
		endpointHost: string;
		errorMessage: string | null;
		createdAt: string;
	}>;
};

type TestPushErrorResponse = {
	error: string;
};

function endpointTail(endpoint: string, max = 48) {
	if (endpoint.length <= max) {
		return endpoint;
	}
	return `…${endpoint.slice(-max)}`;
}

export function PushDeliveryDebugCard() {
	const notifications = useNotificationsContext();
	const [open, setOpen] = useState(false);
	const [loading, setLoading] = useState(false);
	const [testLoading, setTestLoading] = useState(false);
	const [debug, setDebug] = useState<PushDebugResponse | null>(null);
	const [localEndpoint, setLocalEndpoint] = useState<string | null>(null);
	const [localHost, setLocalHost] = useState<string | null>(null);
	const [registeredMatch, setRegisteredMatch] = useState<boolean | null>(null);
	const [lastTestResult, setLastTestResult] = useState<{
		httpStatus: number;
		body: TestPushSuccessResponse | TestPushErrorResponse | Record<string, unknown>;
	} | null>(null);
	const loadedForOpenRef = useRef(false);

	const resolveLocalEndpoint = useCallback(async (): Promise<string | null> => {
		if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
			setLocalEndpoint(null);
			setLocalHost(null);
			return null;
		}
		try {
			const registration = await navigator.serviceWorker.ready;
			const sub = await registration.pushManager.getSubscription();
			const ep = sub?.endpoint ?? null;
			setLocalEndpoint(ep);
			if (ep) {
				try {
					setLocalHost(new URL(ep).hostname);
				} catch {
					setLocalHost(null);
				}
			} else {
				setLocalHost(null);
			}
			return ep;
		} catch {
			setLocalEndpoint(null);
			setLocalHost(null);
			return null;
		}
	}, []);

	const loadDebug = useCallback(async () => {
		setLoading(true);
		try {
			const res = await fetch('/api/push/debug', { credentials: 'include' });
			if (!res.ok) {
				throw new Error('Failed to load');
			}
			const data = (await res.json()) as PushDebugResponse;
			setDebug(data);

			const ep = await resolveLocalEndpoint();
			if (ep) {
				const matchRes = await fetch('/api/push/debug', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					credentials: 'include',
					body: JSON.stringify({ localEndpoint: ep }),
				});
				if (matchRes.ok) {
					const m = (await matchRes.json()) as { localEndpointRegistered: boolean };
					setRegisteredMatch(m.localEndpointRegistered);
				} else {
					setRegisteredMatch(null);
				}
			} else {
				setRegisteredMatch(null);
			}
		} catch {
			toast.error('Could not load push debug data');
			setDebug(null);
		} finally {
			setLoading(false);
		}
	}, [resolveLocalEndpoint]);

	const refreshAll = useCallback(async () => {
		await loadDebug();
		notifications?.refreshSwPushReceivedAt();
	}, [loadDebug, notifications]);

	const sendTestPush = useCallback(async () => {
		setTestLoading(true);
		try {
			const res = await fetch('/api/push/test', { method: 'POST', credentials: 'include' });
			const data = (await res.json().catch(() => ({}))) as TestPushSuccessResponse | TestPushErrorResponse;
			setLastTestResult({ httpStatus: res.status, body: data });
			if (!res.ok) {
				const err = 'error' in data && typeof data.error === 'string' ? data.error : 'Test failed';
				throw new Error(err);
			}
			toast.success('ok' in data && data.message ? data.message : 'Test push sent');
			await refreshAll();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Test push failed');
		} finally {
			setTestLoading(false);
		}
	}, [refreshAll]);

	const buildDiagnosticsExport = useCallback(() => {
		return {
			capturedAt: new Date().toISOString(),
			hint: 'Paste this entire JSON to support. Redact long URLs if you prefer.',
			client: {
				userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
				notificationPermission: notifications?.pushPermission ?? null,
				pushSubscriptionPresent: notifications?.pushEnabled ?? null,
				localEndpointHost: localHost,
				localEndpoint: localEndpoint,
				serverHasLocalEndpoint: registeredMatch,
				swLastPushReceivedAt: notifications?.swLastPushReceivedAt ?? null,
				displayModeStandalone:
					typeof window !== 'undefined' &&
					(window.matchMedia('(display-mode: standalone)').matches ||
						window.matchMedia('(display-mode: fullscreen)').matches),
			},
			serverPushDebug: debug,
			lastTestPushHttp: lastTestResult?.httpStatus ?? null,
			lastTestPushBody: lastTestResult?.body ?? null,
		};
	}, [
		debug,
		localEndpoint,
		localHost,
		lastTestResult,
		notifications?.pushEnabled,
		notifications?.pushPermission,
		notifications?.swLastPushReceivedAt,
		registeredMatch,
	]);

	const copyDiagnostics = useCallback(async () => {
		const text = JSON.stringify(buildDiagnosticsExport(), null, 2);
		try {
			await navigator.clipboard.writeText(text);
			toast.success('Diagnostics copied to clipboard');
		} catch {
			toast.error('Could not copy — select the text below manually');
		}
	}, [buildDiagnosticsExport, toast]);

	useEffect(() => {
		if (!open) {
			loadedForOpenRef.current = false;
			return;
		}
		if (!loadedForOpenRef.current) {
			loadedForOpenRef.current = true;
			void loadDebug();
		}
	}, [open, loadDebug]);

	if (process.env.NODE_ENV !== 'production') {
		return null;
	}

	return (
		<Card className="border-dashed">
			<Collapsible open={open} onOpenChange={setOpen}>
				<CardHeader className="pb-2">
					<CollapsibleTrigger className="flex w-full items-start justify-between gap-2 text-left">
						<div className="space-y-1">
							<CardTitle className="flex items-center gap-2 text-base sm:text-lg">
								<Bug className="h-5 w-5 shrink-0" aria-hidden />
								Push delivery debug
							</CardTitle>
							<CardDescription>
								Use this on the phone or PWA that should receive pushes. Send test push while signed in as
								the same user (no second device needed). After that works, you can verify with another
								account for real messages.
							</CardDescription>
						</div>
						<ChevronDown
							className={cn('mt-1 h-5 w-5 shrink-0 transition-transform', open && 'rotate-180')}
							aria-hidden
						/>
					</CollapsibleTrigger>
				</CardHeader>
				<CollapsibleContent>
					<CardContent className="space-y-4 border-t pt-4">
						<div className="flex flex-wrap gap-2">
							<Button
								type="button"
								variant="secondary"
								size="sm"
								disabled={loading}
								onClick={() => void refreshAll()}
							>
								{loading ? (
									<Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
								) : (
									<RefreshCw className="mr-2 h-4 w-4" aria-hidden />
								)}
								Refresh
							</Button>
							<Button
								type="button"
								size="sm"
								disabled={testLoading || loading}
								onClick={() => void sendTestPush()}
							>
								{testLoading ? (
									<Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
								) : null}
								Send test push
							</Button>
							<Button
								type="button"
								variant="outline"
								size="sm"
								disabled={!debug && !lastTestResult}
								onClick={() => void copyDiagnostics()}
							>
								<Copy className="mr-2 h-4 w-4" aria-hidden />
								Copy diagnostics JSON
							</Button>
						</div>

						<dl className="grid gap-2 text-sm">
							<div className="flex flex-wrap gap-x-2">
								<dt className="text-muted-foreground">Notification permission</dt>
								<dd className="font-medium">{notifications?.pushPermission ?? '—'}</dd>
							</div>
							<div className="flex flex-wrap gap-x-2">
								<dt className="text-muted-foreground">Local PushSubscription</dt>
								<dd className="font-medium">{notifications?.pushEnabled ? 'present' : 'none'}</dd>
							</div>
							<div className="flex flex-wrap gap-x-2">
								<dt className="text-muted-foreground">This device endpoint host</dt>
								<dd className="break-all font-medium">{localHost ?? '—'}</dd>
							</div>
							{localEndpoint && (
								<div>
									<dt className="text-muted-foreground">Endpoint tail</dt>
									<dd className="mt-1 break-all font-mono text-xs">{endpointTail(localEndpoint, 64)}</dd>
								</div>
							)}
							<div className="flex flex-wrap gap-x-2">
								<dt className="text-muted-foreground">Server has this device endpoint</dt>
								<dd className="font-medium">
									{registeredMatch === null
										? 'Open panel and Refresh'
										: registeredMatch
											? 'yes'
											: 'no — tap Refresh (or toggle push off/on)'}
								</dd>
							</div>
							<div className="flex flex-wrap gap-x-2">
								<dt className="text-muted-foreground">SW last received push (this browser)</dt>
								<dd className="break-all font-medium text-xs">
									{notifications?.swLastPushReceivedAt ?? '—'}
								</dd>
							</div>
						</dl>

						{debug && (
							<div className="space-y-2 rounded-lg border bg-muted/20 p-3 text-sm">
								{debug.messagePushHint && (
									<p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-amber-950 dark:text-amber-100">
										{debug.messagePushHint}
									</p>
								)}
								{debug.effectiveChannelsByType?.NEW_MESSAGE && (
									<p>
										<span className="text-muted-foreground">NEW_MESSAGE channels: </span>
										<span className="font-mono">
											inApp={String(debug.effectiveChannelsByType.NEW_MESSAGE.inApp)} push=
											{String(debug.effectiveChannelsByType.NEW_MESSAGE.push)}
										</span>
									</p>
								)}
								<p>
									<span className="text-muted-foreground">Server status: </span>
									<span className="font-mono font-medium">{debug.computedStatus}</span>
								</p>
								<p>
									<span className="text-muted-foreground">VAPID configured: </span>
									<span className="font-medium">{debug.configured ? 'yes' : 'no'}</span>
								</p>
								<p>
									<span className="text-muted-foreground">Stored subscriptions: </span>
									<span className="font-medium">{debug.subscriptions.length}</span>
								</p>
								{debug.lastAttemptSummary && (
									<div className="rounded border bg-background/80 p-2 text-xs">
										<p className="font-medium">Last send attempt</p>
										<p className="mt-1 text-muted-foreground">
											{debug.lastAttemptSummary.createdAt} —{' '}
											{debug.lastAttemptSummary.success ? 'success' : 'failure'}
											{debug.lastAttemptSummary.statusCode != null
												? ` (HTTP ${debug.lastAttemptSummary.statusCode})`
												: ''}{' '}
											— {debug.lastAttemptSummary.endpointHost}
										</p>
										{!debug.lastAttemptSummary.success && debug.lastAttemptSummary.errorMessage && (
											<p className="mt-1 break-words text-destructive">
												{debug.lastAttemptSummary.errorMessage}
											</p>
										)}
									</div>
								)}
								{debug.recentAttempts.length > 0 && (
									<details className="text-xs">
										<summary className="cursor-pointer font-medium">
											Recent attempts ({debug.recentAttempts.length})
										</summary>
										<ul className="mt-2 max-h-40 space-y-1 overflow-y-auto font-mono">
											{debug.recentAttempts.map(a => (
												<li key={a.id}>
													{a.success ? 'OK' : 'FAIL'} {a.statusCode ?? '—'} {a.endpointHost} {a.purpose}{' '}
													{a.payloadTag ? `[${a.payloadTag}]` : ''}
												</li>
											))}
										</ul>
									</details>
								)}
							</div>
						)}

						{(debug || lastTestResult) && (
							<div className="pointer-events-auto space-y-2">
								<Label className="text-sm font-medium">Diagnostics export (copy & paste)</Label>
								<p className="text-xs text-muted-foreground">
									After Refresh and optionally Send test push, copy this and paste it into chat. No Vercel
									logs needed.
								</p>
								<textarea
									readOnly
									className="pointer-events-auto max-h-64 w-full resize-y rounded-md border border-input bg-muted/40 px-3 py-2 font-mono text-[11px] leading-relaxed"
									rows={12}
									value={JSON.stringify(buildDiagnosticsExport(), null, 2)}
									onFocus={e => e.target.select()}
									aria-label="Push diagnostics JSON"
								/>
							</div>
						)}
					</CardContent>
				</CollapsibleContent>
			</Collapsible>
		</Card>
	);
}
