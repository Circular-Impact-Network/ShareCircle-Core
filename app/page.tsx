'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

export default function RootPage() {
	const router = useRouter();
	const { status } = useSession();

	useEffect(() => {
		if (status === 'loading') return;

		if (status === 'authenticated') {
			router.replace('/home');
		} else {
			router.replace('/landing');
		}
	}, [status, router]);

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
