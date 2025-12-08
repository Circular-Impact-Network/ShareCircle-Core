'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sidebar } from '@/components/app/sidebar';
import { DashboardHome } from '@/components/pages/dashboard-home';
import { BrowseListingsPage } from '@/components/pages/browse-listings-page';
import { MyListingsPage } from '@/components/pages/my-listings-page';
import { CirclesPage } from '@/components/pages/circles-page';
import { CircleDetailsPage } from '@/components/pages/circle-details-page';
import { MessagesPage } from '@/components/pages/messages-page';
import { SettingsPage } from '@/components/pages/settings-page';
import { useAppDispatch } from '@/lib/redux/hooks';
import { toggleMobileSidebar } from '@/lib/redux/slices/uiSlice';
import { useUserSync } from '@/hooks/useUserSync';

function DashboardContent() {
	const router = useRouter();
	const { data: session, status } = useSession();
	const searchParams = useSearchParams();
	const [currentPage, setCurrentPage] = useState('home');
	const [selectedCircleId, setSelectedCircleId] = useState<string | null>(null);
	const [mounted, setMounted] = useState(false);
	const circleIdProcessedRef = useRef(false);
	const dispatch = useAppDispatch();

	// Sync user data from session to Redux
	useUserSync();

	useEffect(() => {
		setMounted(true);
	}, []);

	// Check for circleId in URL params and navigate to circle details if present
	useEffect(() => {
		if (mounted && status === 'authenticated' && !circleIdProcessedRef.current) {
			const circleId = searchParams.get('circleId');
			if (circleId) {
				setSelectedCircleId(circleId);
				setCurrentPage('circle-details');
				circleIdProcessedRef.current = true;
				// Clean up URL by removing the query parameter
				router.replace('/dashboard');
			}
		}
	}, [mounted, status, searchParams, router]);

	useEffect(() => {
		if (mounted && status === 'unauthenticated') {
			router.push('/login');
		}
	}, [mounted, status, router]);

	// Show loading while checking authentication or during SSR
	if (!mounted || status === 'loading' || status === 'unauthenticated') {
		return (
			<div className="flex h-screen items-center justify-center bg-background">
				<div className="text-center">
					<div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center mx-auto mb-4">
						<span className="text-primary-foreground font-bold text-sm">SC</span>
					</div>
					<p className="text-muted-foreground">Loading...</p>
				</div>
			</div>
		);
	}

	const renderPage = () => {
		switch (currentPage) {
			case 'home':
				return <DashboardHome onNavigate={setCurrentPage} />;
			case 'browse':
				return <BrowseListingsPage />;
			case 'my-listings':
				return <MyListingsPage />;
			case 'circles':
				return (
					<CirclesPage
						onSelectCircle={id => {
							setSelectedCircleId(id);
							setCurrentPage('circle-details');
						}}
					/>
				);
			case 'circle-details':
				return <CircleDetailsPage circleId={selectedCircleId!} onBack={() => setCurrentPage('circles')} />;
			case 'messages':
				return <MessagesPage />;
			case 'settings':
				return <SettingsPage />;
			default:
				return <DashboardHome onNavigate={setCurrentPage} />;
		}
	};

	return (
		<div className="flex h-screen bg-background overflow-hidden">
			<Sidebar currentPage={currentPage} onPageChange={setCurrentPage} />
			<main className="flex-1 overflow-auto">
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
				{renderPage()}
			</main>
		</div>
	);
}

export default function Dashboard() {
	return (
		<Suspense
			fallback={
				<div className="flex h-screen items-center justify-center bg-background">
					<div className="text-center">
						<div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center mx-auto mb-4">
							<span className="text-primary-foreground font-bold text-sm">SC</span>
						</div>
						<p className="text-muted-foreground">Loading...</p>
					</div>
				</div>
			}
		>
			<DashboardContent />
		</Suspense>
	);
}
