import { useEffect, useState, useSyncExternalStore } from 'react';

function getServerSnapshot() {
	// Return false on server to avoid hydration mismatch
	// Mobile-first approach: default to mobile view
	return false;
}

export function useMediaQuery(query: string) {
	const subscribe = (callback: () => void) => {
		if (typeof window === 'undefined') return () => {};
		const mediaQuery = window.matchMedia(query);

		if (mediaQuery.addEventListener) {
			mediaQuery.addEventListener('change', callback);
			return () => mediaQuery.removeEventListener('change', callback);
		}

		mediaQuery.addListener(callback);
		return () => mediaQuery.removeListener(callback);
	};

	const getSnapshot = () => {
		if (typeof window === 'undefined') return false;
		return window.matchMedia(query).matches;
	};

	return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
