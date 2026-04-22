'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sidebar } from '@/components/app/sidebar';
import { useAppDispatch } from '@/lib/redux/hooks';
import { toggleMobileSidebar } from '@/lib/redux/slices/uiSlice';
import { useUserSync } from '@/hooks/useUserSync';
import { NotificationsProvider } from '@/components/providers/notifications-provider';

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
	const router = useRouter();
	const pathname = usePathname();
	const { data: session, status } = useSession();
	const [mounted, setMounted] = useState(false);
	const dispatch = useAppDispatch();

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
				<div className="text-center">
					{/* Local static asset; <img> avoids next/image in loading shell */}
					<img src="/share-circle-logo-no-name.png" alt="ShareCircle" className="h-14 w-14 mx-auto mb-4" />
					<p className="text-muted-foreground">Loading...</p>
				</div>
			</div>
		);
	}

	return (
		<NotificationsProvider>
			<div className="h-[100dvh] bg-background">
				<Sidebar />
				<main
					data-scroll-root="authenticated-main"
					className="app-scrollbar h-[100dvh] overflow-x-hidden overflow-y-auto pt-14 lg:ml-60 lg:pt-0"
				>
					{/* Mobile menu button */}
					<Button
						type="button"
						variant="outline"
						size="icon"
						onClick={() => dispatch(toggleMobileSidebar())}
						className="fixed left-3 top-3 z-30 h-9 w-9 bg-card shadow-lg lg:hidden"
					>
						<Menu className="h-4 w-4" />
					</Button>
					{children}
				</main>
			</div>
		</NotificationsProvider>
	);
}
