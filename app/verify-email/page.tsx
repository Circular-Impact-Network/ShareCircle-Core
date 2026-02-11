'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

function VerifyEmailRedirect() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const email = searchParams.get('email');

	useEffect(() => {
		const query = email ? `?mode=verify&email=${encodeURIComponent(email)}` : '?mode=verify';
		router.replace(`/signup${query}`);
	}, [email, router]);

	return (
		<div className="min-h-[100dvh] flex items-center justify-center bg-background">
			<div className="text-center">
				<Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
				<p className="text-muted-foreground">Redirecting...</p>
			</div>
		</div>
	);
}

export default function VerifyEmailPage() {
	return (
		<Suspense
			fallback={
				<div className="min-h-[100dvh] flex items-center justify-center bg-background">
					<div className="text-center">
						<Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
						<p className="text-muted-foreground">Loading...</p>
					</div>
				</div>
			}
		>
			<VerifyEmailRedirect />
		</Suspense>
	);
}
