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
				{/* eslint-disable-next-line @next/next/no-img-element */}
				<img src="/share-circle-logo-no-name.png" alt="ShareCircle" className="h-14 w-14 mx-auto mb-4" />
				<p className="text-muted-foreground">Loading...</p>
			</div>
		</div>
	);
}
