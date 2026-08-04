'use client';

import { useEffect } from 'react';

import { isDesktopDevice } from '@/lib/device';

// Suppresses the browser's *native* PWA install mini-infobar on desktop.
//
// This cannot suppress our own install card — a preventDefault() here does not stop the
// sibling PWAProvider's listener from firing, which is why desktop users kept seeing the
// custom card until PWAProvider got its own device gate. Shares the detection helper so the
// two can't disagree about what "desktop" means.
export function PWAInstallGuard() {
	useEffect(() => {
		const handler = (e: Event) => {
			if (isDesktopDevice()) {
				e.preventDefault();
			}
		};
		window.addEventListener('beforeinstallprompt', handler);
		return () => window.removeEventListener('beforeinstallprompt', handler);
	}, []);
	return null;
}
