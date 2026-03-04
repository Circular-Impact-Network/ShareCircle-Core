'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, RefreshCcw, WifiOff, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { cn } from '@/lib/utils';
import { isIosBrowser, isStandaloneDisplayMode } from '@/lib/push-client';

type BeforeInstallPromptEvent = Event & {
	prompt: () => Promise<void>;
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

const IOS_PROMPT_DISMISS_KEY = 'sharecircle_ios_install_prompt_dismissed';
const INSTALL_PROMPT_DISMISS_KEY = 'sharecircle_install_prompt_dismissed';

export function PWAProvider() {
	const isOnline = useOnlineStatus();
	const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
	const [showInstallPrompt, setShowInstallPrompt] = useState(false);
	const [showIosPrompt, setShowIosPrompt] = useState(false);
	const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
	const [updateAvailable, setUpdateAvailable] = useState(false);
	const [isInstalled, setIsInstalled] = useState(false);
	const isRefreshingRef = useRef(false);

	const shouldShowOfflineBanner = useMemo(() => !isOnline, [isOnline]);

	useEffect(() => {
		if (typeof window === 'undefined') {
			return;
		}

		const timer = window.setTimeout(() => {
			const installed = isStandaloneDisplayMode();
			const dismissedInstallPrompt =
				window.localStorage.getItem(INSTALL_PROMPT_DISMISS_KEY) === 'true';
			const dismissedIosPrompt =
				window.localStorage.getItem(IOS_PROMPT_DISMISS_KEY) === 'true';

			setIsInstalled(installed);
			setShowIosPrompt(isIosBrowser() && !dismissedIosPrompt && !installed);
			setShowInstallPrompt(!dismissedInstallPrompt);
		}, 0);

		return () => {
			window.clearTimeout(timer);
		};
	}, []);

	useEffect(() => {
		if (typeof window === 'undefined' || !('serviceWorker' in navigator) || process.env.NODE_ENV !== 'production') {
			return;
		}

		const handleControllerChange = () => {
			if (isRefreshingRef.current) {
				return;
			}

			isRefreshingRef.current = true;
			window.location.reload();
		};

		const handleServiceWorkerMessage = (event: MessageEvent<{ type?: string }>) => {
			if (event.data?.type === 'SC_PUSH_EVENT') {
				// Realtime channels already handle visible-state updates for active users.
			}
		};

		const registerServiceWorker = async () => {
			const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });

			if (registration.waiting) {
				setWaitingWorker(registration.waiting);
				setUpdateAvailable(true);
			}

			registration.addEventListener('updatefound', () => {
				const installingWorker = registration.installing;
				if (!installingWorker) {
					return;
				}

				installingWorker.addEventListener('statechange', () => {
					if (
						installingWorker.state === 'installed' &&
						navigator.serviceWorker.controller
					) {
						setWaitingWorker(registration.waiting ?? installingWorker);
						setUpdateAvailable(true);
					}
				});
			});
		};

		registerServiceWorker().catch(error => {
			console.error('Service worker registration failed:', error);
		});

		navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
		navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);

		return () => {
			navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
			navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
		};
	}, []);

	useEffect(() => {
		if (typeof window === 'undefined') {
			return;
		}

		const handleBeforeInstallPrompt = (event: Event) => {
			event.preventDefault();
			setInstallPrompt(event as BeforeInstallPromptEvent);
		};

		const handleAppInstalled = () => {
			setInstallPrompt(null);
			setIsInstalled(true);
			setShowInstallPrompt(false);
			window.localStorage.setItem(INSTALL_PROMPT_DISMISS_KEY, 'true');
		};

		window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
		window.addEventListener('appinstalled', handleAppInstalled);

		return () => {
			window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
			window.removeEventListener('appinstalled', handleAppInstalled);
		};
	}, []);

	const dismissInstallPrompt = () => {
		if (typeof window !== 'undefined') {
			window.localStorage.setItem(INSTALL_PROMPT_DISMISS_KEY, 'true');
		}
		setShowInstallPrompt(false);
	};

	const dismissIosPrompt = () => {
		if (typeof window !== 'undefined') {
			window.localStorage.setItem(IOS_PROMPT_DISMISS_KEY, 'true');
		}
		setShowIosPrompt(false);
	};

	const handleInstall = async () => {
		if (!installPrompt) {
			return;
		}

		await installPrompt.prompt();
		const choice = await installPrompt.userChoice;

		if (choice.outcome === 'accepted') {
			dismissInstallPrompt();
		}
	};

	const handleRefresh = () => {
		if (!waitingWorker) {
			return;
		}

		waitingWorker.postMessage({ type: 'SKIP_WAITING' });
	};

	return (
		<div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
			<div className="flex w-full max-w-md flex-col gap-3">
				{shouldShowOfflineBanner && (
					<div className="pointer-events-auto rounded-2xl border border-amber-300/60 bg-amber-50/95 p-4 text-amber-950 shadow-lg backdrop-blur dark:border-amber-500/30 dark:bg-amber-950/90 dark:text-amber-100">
						<div className="flex items-start gap-3">
							<div className="mt-0.5 rounded-full bg-amber-500/15 p-2">
								<WifiOff className="h-4 w-4" />
							</div>
							<div className="flex-1">
								<p className="text-sm font-semibold">Offline mode is active</p>
								<p className="mt-1 text-sm opacity-85">
									You can still browse cached screens, but uploads and message sends need a connection.
								</p>
							</div>
						</div>
					</div>
				)}

				{updateAvailable && (
					<div className="pointer-events-auto rounded-2xl border border-border bg-card/95 p-4 shadow-lg backdrop-blur">
						<div className="flex items-start gap-3">
							<div className="mt-0.5 rounded-full bg-primary/10 p-2 text-primary">
								<RefreshCcw className="h-4 w-4" />
							</div>
							<div className="flex-1">
								<p className="text-sm font-semibold text-foreground">Update ready</p>
								<p className="mt-1 text-sm text-muted-foreground">
									A newer version of ShareCircle is available.
								</p>
							</div>
						</div>
						<div className="mt-4 flex gap-2">
							<Button className="flex-1" onClick={handleRefresh}>
								Refresh now
							</Button>
							<Button
								variant="outline"
								onClick={() => {
									setUpdateAvailable(false);
									setWaitingWorker(null);
								}}
							>
								Later
							</Button>
						</div>
					</div>
				)}

				{!isInstalled && installPrompt && showInstallPrompt && (
					<div className="pointer-events-auto rounded-2xl border border-border bg-card/95 p-4 shadow-lg backdrop-blur">
						<div className="flex items-start gap-3">
							<div className="mt-0.5 rounded-full bg-primary/10 p-2 text-primary">
								<Download className="h-4 w-4" />
							</div>
							<div className="flex-1">
								<p className="text-sm font-semibold text-foreground">Install ShareCircle</p>
								<p className="mt-1 text-sm text-muted-foreground">
									Add the app to your home screen for full-screen use, push alerts, and faster loading.
								</p>
							</div>
							<Button
								variant="ghost"
								size="icon"
								className={cn('h-8 w-8 rounded-full')}
								onClick={dismissInstallPrompt}
							>
								<X className="h-4 w-4" />
							</Button>
						</div>
						<div className="mt-4 flex gap-2">
							<Button className="flex-1" onClick={handleInstall}>
								Install app
							</Button>
							<Button variant="outline" onClick={dismissInstallPrompt}>
								Not now
							</Button>
						</div>
					</div>
				)}

				{!isInstalled && !installPrompt && showIosPrompt && (
					<div className="pointer-events-auto rounded-2xl border border-border bg-card/95 p-4 shadow-lg backdrop-blur">
						<div className="flex items-start gap-3">
							<div className="mt-0.5 rounded-full bg-primary/10 p-2 text-primary">
								<Download className="h-4 w-4" />
							</div>
							<div className="flex-1">
								<p className="text-sm font-semibold text-foreground">Install on iPhone</p>
								<p className="mt-1 text-sm text-muted-foreground">
									Open Safari&apos;s share menu, then choose Add to Home Screen to enable the full PWA experience.
								</p>
							</div>
							<Button
								variant="ghost"
								size="icon"
								className="h-8 w-8 rounded-full"
								onClick={dismissIosPrompt}
							>
								<X className="h-4 w-4" />
							</Button>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
