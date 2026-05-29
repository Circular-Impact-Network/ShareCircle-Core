'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function OfflinePage() {
	const [isRetrying, setIsRetrying] = useState(false);

	// Auto-recover: if the browser thinks we're online (or comes back online),
	// retry the navigation the user originally wanted. This handles the case
	// where the service worker false-positives an offline state (e.g., a slow
	// Vercel cold start tripped the network-first timeout).
	useEffect(() => {
		if (typeof window === 'undefined') return;

		const retry = () => {
			if (navigator.onLine) {
				window.location.replace('/');
			}
		};

		// Try once on mount in case we landed here while actually online.
		retry();

		window.addEventListener('online', retry);
		return () => window.removeEventListener('online', retry);
	}, []);

	const handleHardReload = async () => {
		setIsRetrying(true);
		// Best-effort: clear any stale runtime caches and unregister service workers
		// before reloading. This is the escape hatch for users stuck behind a bad SW.
		try {
			if ('serviceWorker' in navigator) {
				const registrations = await navigator.serviceWorker.getRegistrations();
				await Promise.all(registrations.map(r => r.unregister()));
			}
			if ('caches' in window) {
				const keys = await caches.keys();
				await Promise.all(keys.filter(k => !k.includes('precache')).map(k => caches.delete(k)));
			}
		} catch {
			// Ignore — we'll reload regardless.
		}
		window.location.replace('/');
	};

	return (
		<div className="flex min-h-[100dvh] items-center justify-center bg-background px-6 py-12">
			<div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-lg">
				{/* Local static asset */}
				<img src="/logo_new_removeBg.png" alt="ShareCircle" className="mx-auto mb-5 h-14 w-14" />
				<h1 className="text-2xl font-semibold text-foreground">You&apos;re offline</h1>
				<p className="mt-3 text-sm leading-6 text-muted-foreground">
					ShareCircle is still available in a limited mode. Reconnect to send messages, upload photos, or
					publish item changes.
				</p>
				<div className="mt-6 flex flex-col gap-3">
					<Button onClick={handleHardReload} disabled={isRetrying} className="w-full">
						{isRetrying ? 'Reloading…' : 'Try again'}
					</Button>
					<Button asChild variant="outline" className="w-full">
						<Link href="/home">Go to Home</Link>
					</Button>
					<Button asChild variant="ghost" className="w-full">
						<Link href="/messages">Open Messages</Link>
					</Button>
				</div>
			</div>
		</div>
	);
}
