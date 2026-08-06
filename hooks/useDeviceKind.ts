'use client';

import { useSyncExternalStore } from 'react';

import { DESKTOP_MEDIA_QUERY, detectDeviceKind, type DeviceKind } from '@/lib/device';

// 'unknown' during SSR and hydration so a desktop never flashes a mobile-only UI for a
// frame. Callers must treat 'unknown' as "not yet known" rather than as a device class.
function getServerSnapshot(): DeviceKind {
	return 'unknown';
}

function subscribe(callback: () => void) {
	if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
		return () => {};
	}
	const mediaQuery = window.matchMedia(DESKTOP_MEDIA_QUERY);

	if (mediaQuery.addEventListener) {
		mediaQuery.addEventListener('change', callback);
		return () => mediaQuery.removeEventListener('change', callback);
	}

	mediaQuery.addListener(callback);
	return () => mediaQuery.removeListener(callback);
}

/**
 * Device class, reactive to pointer/hover capability changes (e.g. a tablet gaining a
 * keyboard). Mirrors useMediaQuery's useSyncExternalStore shape — no effect, so no
 * setState-in-effect cascade.
 */
export function useDeviceKind(): DeviceKind {
	return useSyncExternalStore(subscribe, detectDeviceKind, getServerSnapshot);
}
