'use client';

/* eslint-disable react-hooks/set-state-in-effect -- sync server-fetched prefs into local form state */
/* eslint-disable react-hooks/preserve-manual-memoization -- isDirty useMemo vs React Compiler expectations */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, ChevronDown, Loader2, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { NotificationPrefsSkeleton } from '@/components/ui/skeletons';
import {
	useGetNotificationPreferencesQuery,
	useUpdateNotificationPreferencesMutation,
	type NotificationChannelOverride,
} from '@/lib/redux/api/notificationPreferencesApi';
import { useNotificationsContext } from '@/components/providers/notifications-provider';

function cloneOverrides(m: Record<string, NotificationChannelOverride>) {
	return JSON.parse(JSON.stringify(m)) as Record<string, NotificationChannelOverride>;
}

function loadErrorCopy(err: unknown): { title: string; detail: string } {
	if (err && typeof err === 'object' && 'status' in err) {
		const fe = err as { status: number; data?: { error?: string; hint?: string } };
		if (fe.status === 401) {
			return {
				title: 'You are not signed in',
				detail: 'Sign in again to manage notification settings.',
			};
		}
		if (fe.data?.hint) {
			return {
				title: fe.data.error || 'Could not load notification preferences',
				detail: fe.data.hint,
			};
		}
		if (typeof fe.data?.error === 'string') {
			return { title: 'Could not load notification preferences', detail: fe.data.error };
		}
	}
	return {
		title: 'Could not load notification preferences',
		detail: 'Check your connection and try again. If this persists, confirm the app database has the latest migrations applied.',
	};
}

export function NotificationPreferencesPanel() {
	const { data, isLoading, isError, error, refetch, isFetching } = useGetNotificationPreferencesQuery();
	const [updatePrefs, { isLoading: isSaving }] = useUpdateNotificationPreferencesMutation();
	const notifications = useNotificationsContext();

	const [globalInApp, setGlobalInApp] = useState(true);
	const [globalPush, setGlobalPush] = useState(true);
	const [categoryOverrides, setCategoryOverrides] = useState<Record<string, NotificationChannelOverride>>({});
	const [typeOverrides, setTypeOverrides] = useState<Record<string, NotificationChannelOverride>>({});

	useEffect(() => {
		if (!data?.stored) {
			return;
		}
		setGlobalInApp(data.stored.globalInApp);
		setGlobalPush(data.stored.globalPush);
		setCategoryOverrides(cloneOverrides(data.stored.categoryOverrides || {}));
		setTypeOverrides(cloneOverrides(data.stored.typeOverrides || {}));
	}, [data?.stored]);

	const isDirty = useMemo(() => {
		if (!data?.stored) {
			return false;
		}
		return (
			globalInApp !== data.stored.globalInApp ||
			globalPush !== data.stored.globalPush ||
			JSON.stringify(categoryOverrides) !== JSON.stringify(data.stored.categoryOverrides || {}) ||
			JSON.stringify(typeOverrides) !== JSON.stringify(data.stored.typeOverrides || {})
		);
	}, [data?.stored, globalInApp, globalPush, categoryOverrides, typeOverrides]);

	const setCategoryChannel = useCallback((categoryId: string, channel: 'inApp' | 'push', on: boolean) => {
		setCategoryOverrides(prev => {
			const next = { ...prev };
			const cur = { ...(next[categoryId] || {}) };
			if (on) {
				delete cur[channel];
			} else {
				cur[channel] = false;
			}
			if (cur.inApp === undefined && cur.push === undefined) {
				delete next[categoryId];
			} else {
				next[categoryId] = cur;
			}
			return next;
		});
	}, []);

	const setTypeChannel = useCallback((typeKey: string, channel: 'inApp' | 'push', on: boolean) => {
		setTypeOverrides(prev => {
			const next = { ...prev };
			const cur = { ...(next[typeKey] || {}) };
			if (on) {
				delete cur[channel];
			} else {
				cur[channel] = false;
			}
			if (cur.inApp === undefined && cur.push === undefined) {
				delete next[typeKey];
			} else {
				next[typeKey] = cur;
			}
			return next;
		});
	}, []);

	const pushMasterDisabled =
		!notifications?.pushSupported || !notifications?.pushConfigured || notifications?.pushPermission === 'denied';

	const devicePushDescription = !notifications?.pushSupported
		? 'Install the app in a supported browser to enable push on this device.'
		: !notifications.pushConfigured
			? 'Push is not configured on the server yet.'
			: notifications.pushPermission === 'denied'
				? 'Unblock notifications in your browser settings to allow this device to receive pushes.'
				: notifications.pushEnabled
					? 'This device is subscribed for background alerts when your account allows push.'
					: 'Turn on to register this device for push when your account allows it.';

	if (isLoading) {
		return <NotificationPrefsSkeleton />;
	}

	if (isError || !data) {
		const { title, detail } = loadErrorCopy(error);
		return (
			<div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
				<p className="font-medium text-destructive">{title}</p>
				<p className="mt-2 text-muted-foreground">{detail}</p>
				<Button type="button" variant="outline" size="sm" className="mt-4 min-h-11" onClick={() => refetch()}>
					Try again
				</Button>
			</div>
		);
	}

	const handleSave = async () => {
		try {
			const res = await updatePrefs({
				globalInApp,
				globalPush,
				categoryOverrides,
				typeOverrides,
			}).unwrap();
			setGlobalInApp(res.stored.globalInApp);
			setGlobalPush(res.stored.globalPush);
			setCategoryOverrides(cloneOverrides(res.stored.categoryOverrides || {}));
			setTypeOverrides(cloneOverrides(res.stored.typeOverrides || {}));
			toast.success('Notification preferences saved');
		} catch {
			toast.error('Failed to save preferences');
		}
	};

	return (
		<div className="space-y-6" data-testid="notification-preferences">
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2 text-base sm:text-lg">
						<Smartphone className="h-5 w-5 shrink-0" aria-hidden />
						This device
					</CardTitle>
					<CardDescription>
						Controls whether <em>this phone or browser </em>
						may receive system push. Account-wide types are below.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="flex min-h-11 flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
						<div className="space-y-1 pr-2">
							<Label htmlFor="device-push-enabled" className="text-base font-medium">
								Allow push on this device
							</Label>
							<p className="text-sm text-muted-foreground">{devicePushDescription}</p>
						</div>
						<Switch
							id="device-push-enabled"
							data-testid="notification-toggle"
							checked={Boolean(notifications?.pushEnabled)}
							disabled={
								!notifications?.pushSupported ||
								!notifications?.pushConfigured ||
								notifications.pushLoading
							}
							onCheckedChange={checked => {
								if (!notifications) {
									return;
								}
								if (checked) {
									void notifications.enablePushNotifications();
									return;
								}
								void notifications.disablePushNotifications();
							}}
							className="shrink-0"
						/>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2 text-base sm:text-lg">
						<Bell className="h-5 w-5 shrink-0" aria-hidden />
						Account notifications
					</CardTitle>
					<CardDescription>
						Choose what we send in the app (alerts and your notifications list) and as push on devices you
						enabled above. Save when you are done.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-6">
					<div
						className="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-1 border-b pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground sm:gap-x-4"
						role="row"
					>
						<span role="columnheader">Topic</span>
						<span role="columnheader" className="w-14 justify-self-end text-center sm:w-16">
							In-app
						</span>
						<span role="columnheader" className="w-14 justify-self-end text-center sm:w-16">
							Push
						</span>
					</div>

					<div className="flex min-h-11 items-center gap-3 rounded-lg border border-border/80 bg-muted/30 px-3 py-2 sm:px-4">
						<div className="min-w-0 flex-1 space-y-0.5">
							<Label htmlFor="global-in-app" className="text-sm font-medium">
								All notifications (in-app)
							</Label>
							<p className="text-xs text-muted-foreground">
								Toasts and entries in your notifications list.
							</p>
						</div>
						<div className="flex w-14 shrink-0 justify-end sm:w-16">
							<Switch
								id="global-in-app"
								checked={globalInApp}
								onCheckedChange={setGlobalInApp}
								aria-label="All in-app notifications"
							/>
						</div>
						<div className="w-14 shrink-0 sm:w-16" />
					</div>

					<div className="flex min-h-11 items-center gap-3 rounded-lg border border-border/80 bg-muted/30 px-3 py-2 sm:px-4">
						<div className="min-w-0 flex-1 space-y-0.5">
							<Label htmlFor="global-push" className="text-sm font-medium">
								All notifications (push)
							</Label>
							<p className="text-xs text-muted-foreground">
								{pushMasterDisabled
									? 'Fix device push above or browser permission to use push toggles.'
									: 'Background alerts on devices where push is enabled.'}
							</p>
						</div>
						<div className="w-14 shrink-0 sm:w-16" />
						<div className="flex w-14 shrink-0 justify-end sm:w-16">
							<Switch
								id="global-push"
								checked={globalPush}
								disabled={pushMasterDisabled}
								onCheckedChange={setGlobalPush}
								aria-label="All push notifications"
							/>
						</div>
					</div>

					{!globalInApp && (
						<p className="text-sm text-muted-foreground">
							In-app is off globally; category and type in-app switches are disabled until you turn it
							back on.
						</p>
					)}

					<div className="space-y-3">
						{data.catalog.map(category => {
							const cat = categoryOverrides[category.id];
							const catInAppOn = cat?.inApp !== false;
							const catPushOn = cat?.push !== false;
							const typeInAppDisabled = !globalInApp || !catInAppOn;
							const typePushDisabled = pushMasterDisabled || !globalPush || !catPushOn;

							return (
								<Collapsible key={category.id} className="group rounded-lg border">
									<div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-4">
										<CollapsibleTrigger className="flex min-h-11 flex-1 items-start gap-2 rounded-md text-left outline-none ring-offset-background hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 -m-1 p-1 sm:-m-0 sm:p-0 sm:hover:bg-transparent">
											<ChevronDown
												className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180"
												aria-hidden
											/>
											<div className="min-w-0">
												<div className="font-medium">{category.title}</div>
												<p className="text-xs text-muted-foreground sm:text-sm">
													{category.description}
												</p>
											</div>
										</CollapsibleTrigger>
										<div className="flex shrink-0 items-center justify-end gap-6 sm:gap-10 pl-6 sm:pl-0">
											<div className="flex flex-col items-center gap-1">
												<span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:hidden">
													In-app
												</span>
												<Switch
													id={`cat-${category.id}-inapp`}
													checked={catInAppOn}
													disabled={!globalInApp}
													onCheckedChange={v => setCategoryChannel(category.id, 'inApp', v)}
													aria-label={`${category.title} in-app`}
												/>
											</div>
											<div className="flex flex-col items-center gap-1">
												<span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:hidden">
													Push
												</span>
												<Switch
													id={`cat-${category.id}-push`}
													checked={catPushOn}
													disabled={pushMasterDisabled || !globalPush}
													onCheckedChange={v => setCategoryChannel(category.id, 'push', v)}
													aria-label={`${category.title} push`}
												/>
											</div>
										</div>
									</div>
									<CollapsibleContent>
										<ul className="space-y-0 border-t">
											{category.types.map(t => {
												const to = typeOverrides[t.type];
												const tinApp = to?.inApp !== false;
												const tpush = to?.push !== false;
												return (
													<li
														key={t.type}
														className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 border-b border-border/60 px-3 py-3 last:border-b-0 sm:px-4"
													>
														<div className="min-w-0 pr-2">
															<Label
																htmlFor={`type-${t.type}-inapp`}
																className="text-sm font-medium"
															>
																{t.title}
															</Label>
															<p className="text-xs text-muted-foreground">
																{t.description}
															</p>
														</div>
														<div className="flex w-14 justify-end sm:w-16">
															<Switch
																id={`type-${t.type}-inapp`}
																checked={tinApp}
																disabled={typeInAppDisabled}
																onCheckedChange={v =>
																	setTypeChannel(t.type, 'inApp', v)
																}
																aria-label={`${t.title} in-app`}
															/>
														</div>
														<div className="flex w-14 justify-end sm:w-16">
															<Switch
																id={`type-${t.type}-push`}
																checked={tpush}
																disabled={typePushDisabled}
																onCheckedChange={v => setTypeChannel(t.type, 'push', v)}
																aria-label={`${t.title} push`}
															/>
														</div>
													</li>
												);
											})}
										</ul>
									</CollapsibleContent>
								</Collapsible>
							);
						})}
					</div>

					<div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
						<p className="text-xs text-muted-foreground">
							{isFetching && !isLoading ? 'Refreshing…' : 'Changes are not saved until you tap Save.'}
						</p>
						<Button
							type="button"
							onClick={() => void handleSave()}
							disabled={!isDirty || isSaving}
							className="min-h-11 w-full sm:w-auto"
						>
							{isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
							Save preferences
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
