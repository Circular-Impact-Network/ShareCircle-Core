'use client';

export type BrowserPushPermission = NotificationPermission | 'unsupported';

export function isPushSupported() {
	return (
		typeof window !== 'undefined' &&
		'serviceWorker' in navigator &&
		'PushManager' in window &&
		'Notification' in window
	);
}

export function getBrowserPushPermission(): BrowserPushPermission {
	if (!isPushSupported()) {
		return 'unsupported';
	}

	return Notification.permission;
}

export function urlBase64ToUint8Array(base64String: string) {
	const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
	const base64 = `${base64String}${padding}`.replace(/-/g, '+').replace(/_/g, '/');
	const rawData = window.atob(base64);
	const outputArray = new Uint8Array(rawData.length);

	for (let index = 0; index < rawData.length; index += 1) {
		outputArray[index] = rawData.charCodeAt(index);
	}

	return outputArray;
}

export function isStandaloneDisplayMode() {
	if (typeof window === 'undefined') {
		return false;
	}

	const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };

	return (
		window.matchMedia('(display-mode: standalone)').matches ||
		window.matchMedia('(display-mode: fullscreen)').matches ||
		navigatorWithStandalone.standalone === true
	);
}

export function isIosBrowser() {
	if (typeof navigator === 'undefined') {
		return false;
	}

	return /iPad|iPhone|iPod/.test(navigator.userAgent);
}
