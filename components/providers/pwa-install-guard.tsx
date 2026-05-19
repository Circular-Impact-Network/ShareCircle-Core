'use client';

import { useEffect } from 'react';

// Intercepts the browser's PWA install prompt and suppresses it on desktop.
// Touch-less, hover-capable devices are treated as desktop.
export function PWAInstallGuard() {
	useEffect(() => {
		const handler = (e: Event) => {
			const isDesktop = window.matchMedia('(pointer: fine) and (hover: hover)').matches;
			if (isDesktop) e.preventDefault();
		};
		window.addEventListener('beforeinstallprompt', handler);
		return () => window.removeEventListener('beforeinstallprompt', handler);
	}, []);
	return null;
}
