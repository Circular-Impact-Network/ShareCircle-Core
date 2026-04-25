'use client';

import { useState, useEffect, useCallback } from 'react';

export type PWAInstallStatus = 'checking' | 'installable' | 'installed' | 'unsupported';
export type PWAUpdateStatus = 'none' | 'checking' | 'downloading' | 'ready';

interface BeforeInstallPromptEvent extends Event {
	prompt(): Promise<void>;
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function usePWAInstall() {
	const [installStatus, setInstallStatus] = useState<PWAInstallStatus>('checking');
	const [updateStatus, setUpdateStatus] = useState<PWAUpdateStatus>('none');
	const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
	const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

	useEffect(() => {
		if (typeof window === 'undefined') return;

		// Detect if already running as installed PWA
		const isStandalone =
			window.matchMedia('(display-mode: standalone)').matches ||
			(navigator as { standalone?: boolean }).standalone === true;

		if (isStandalone) {
			setInstallStatus('installed');
		}

		// Capture the browser install prompt
		const handlePrompt = (e: Event) => {
			e.preventDefault();
			setDeferredPrompt(e as BeforeInstallPromptEvent);
			if (!isStandalone) setInstallStatus('installable');
		};
		window.addEventListener('beforeinstallprompt', handlePrompt);

		// Track when the user accepts the install
		const handleInstalled = () => setInstallStatus('installed');
		window.addEventListener('appinstalled', handleInstalled);

		// Set up service worker update detection
		if ('serviceWorker' in navigator) {
			navigator.serviceWorker.getRegistration().then(reg => {
				if (!reg) return;
				setRegistration(reg);

				// A waiting worker means an update is already downloaded and ready
				if (reg.waiting) {
					setUpdateStatus('ready');
				}

				reg.addEventListener('updatefound', () => {
					const newWorker = reg.installing;
					if (!newWorker) return;
					setUpdateStatus('downloading');
					newWorker.addEventListener('statechange', () => {
						if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
							setUpdateStatus('ready');
						}
					});
				});
			});

			// When a new SW takes control, the page is freshly activated
			navigator.serviceWorker.addEventListener('controllerchange', () => {
				// Reload is already triggered by applyUpdate — don't double-reload
			});
		}

		// If no prompt fires within 3 s, the browser won't prompt (e.g. already installed, not supported)
		const fallbackTimer = setTimeout(() => {
			setInstallStatus(prev => (prev === 'checking' ? 'unsupported' : prev));
		}, 3000);

		return () => {
			window.removeEventListener('beforeinstallprompt', handlePrompt);
			window.removeEventListener('appinstalled', handleInstalled);
			clearTimeout(fallbackTimer);
		};
	}, []);

	const install = useCallback(async (): Promise<boolean> => {
		if (!deferredPrompt) return false;
		await deferredPrompt.prompt();
		const { outcome } = await deferredPrompt.userChoice;
		if (outcome === 'accepted') {
			setInstallStatus('installed');
			setDeferredPrompt(null);
			return true;
		}
		return false;
	}, [deferredPrompt]);

	const checkForUpdates = useCallback(async () => {
		if (!registration) return;
		setUpdateStatus('checking');
		try {
			await registration.update();
			// If there's a waiting worker after the update check, it's ready
			if (registration.waiting) {
				setUpdateStatus('ready');
			} else {
				setUpdateStatus('none');
			}
		} catch {
			setUpdateStatus('none');
		}
	}, [registration]);

	const applyUpdate = useCallback(() => {
		if (!registration?.waiting) return;
		// Tell the waiting service worker to activate immediately
		registration.waiting.postMessage({ type: 'SKIP_WAITING' });
		// Reload so the new SW takes over
		window.location.reload();
	}, [registration]);

	return { installStatus, updateStatus, install, checkForUpdates, applyUpdate };
}
