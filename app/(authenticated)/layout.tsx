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

export default function AuthenticatedLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const router = useRouter();
	const pathname = usePathname();
	const { status } = useSession();
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

	// Show loading while checking authentication or during SSR
	if (!mounted || status === 'loading' || status === 'unauthenticated') {
		return (
			<div className="flex min-h-[100dvh] items-center justify-center bg-background">
				<div className="text-center">
					<div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center mx-auto mb-4">
						<span className="text-primary-foreground font-bold text-sm">SC</span>
					</div>
					<p className="text-muted-foreground">Loading...</p>
				</div>
			</div>
		);
	}

	return (
		<NotificationsProvider>
			<div className="min-h-[100dvh] bg-background">
				<Sidebar />
				<main className="lg:ml-64 min-h-[100dvh] overflow-auto">
					{/* Mobile menu button */}
					<Button
						type="button"
						variant="outline"
						size="icon"
						onClick={() => dispatch(toggleMobileSidebar())}
						className="fixed left-4 top-4 z-30 bg-card shadow-lg lg:hidden"
					>
						<Menu className="h-5 w-5" />
					</Button>
					{children}
				</main>
			</div>
		</NotificationsProvider>
	);
}
