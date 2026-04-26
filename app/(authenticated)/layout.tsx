'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Sidebar } from '@/components/app/sidebar';
import { MobileHeader } from '@/components/app/mobile-header';
import { BottomNav } from '@/components/app/bottom-nav';
import { useUserSync } from '@/hooks/useUserSync';
import { NotificationsProvider } from '@/components/providers/notifications-provider';

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
	const router = useRouter();
	const pathname = usePathname();
	const { data: session, status } = useSession();
	const [mounted, setMounted] = useState(false);

	// Sync user data from session to Redux
	useUserSync();

	useEffect(() => {
		// Use setTimeout to avoid calling setState synchronously in effect
		const timer = setTimeout(() => {
			setMounted(true);
		}, 0);
		return () => clearTimeout(timer);
	}, []);

	useEffect(() => {
		if (mounted && status === 'unauthenticated') {
			router.push(`/login?callbackUrl=${encodeURIComponent(pathname)}`);
		}
	}, [mounted, status, router, pathname]);

	// Check if email is verified - redirect to signup verify flow if not
	useEffect(() => {
		if (mounted && status === 'authenticated' && session?.user?.email && !session.user.emailVerified) {
			router.push(`/signup?mode=verify&email=${encodeURIComponent(session.user.email)}`);
		}
	}, [mounted, status, session, router]);

	// Show loading while checking authentication or during SSR
	if (!mounted || status === 'loading' || status === 'unauthenticated') {
		return (
			<div className="flex min-h-[100dvh] items-center justify-center bg-background">
				{/* Local static asset; <img> avoids next/image in loading shell */}
				<div className="rounded-full bg-white p-3 shadow-md animate-pulse">
					<img src="/share-circle-icon-square.png" alt="ShareCircle" className="h-12 w-12 object-contain" />
				</div>
			</div>
		);
	}

	return (
		<NotificationsProvider>
			<div className="flex h-[100dvh] flex-col bg-background">
				<Sidebar />
				<MobileHeader />
				{/* Spacer for slim mobile header */}
				<div className="h-12 shrink-0 lg:hidden" aria-hidden="true" />
				<main
					data-scroll-root="authenticated-main"
					className="app-scrollbar min-h-0 flex-1 overflow-x-hidden overflow-y-auto lg:ml-60 pb-bottom-nav lg:pb-0"
				>
					{children}
				</main>
				<BottomNav />
			</div>
		</NotificationsProvider>
	);
}
