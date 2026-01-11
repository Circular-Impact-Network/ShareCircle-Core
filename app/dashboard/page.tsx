'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function DashboardRedirectContent() {
	const router = useRouter();
	const searchParams = useSearchParams();

	useEffect(() => {
		const circleId = searchParams.get('circleId');
		if (circleId) {
			// Redirect to circle details page if circleId is present
			router.replace(`/circles/${circleId}`);
		} else {
			// Default redirect to home/browse page
			router.replace('/home');
		}
	}, [router, searchParams]);

	return (
		<div className="flex min-h-[100dvh] items-center justify-center bg-background">
			<div className="text-center">
				<div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center mx-auto mb-4">
					<span className="text-primary-foreground font-bold text-sm">SC</span>
				</div>
				<p className="text-muted-foreground">Redirecting...</p>
			</div>
		</div>
	);
}

export default function DashboardRedirect() {
	return (
		<Suspense
			fallback={
				<div className="flex min-h-[100dvh] items-center justify-center bg-background">
					<div className="text-center">
						<div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center mx-auto mb-4">
							<span className="text-primary-foreground font-bold text-sm">SC</span>
						</div>
						<p className="text-muted-foreground">Loading...</p>
					</div>
				</div>
			}
		>
			<DashboardRedirectContent />
		</Suspense>
	);
}
