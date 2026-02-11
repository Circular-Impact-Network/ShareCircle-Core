'use client';

import { useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

function ForgotPasswordRedirect() {
	const router = useRouter();

	useEffect(() => {
		router.replace('/login?mode=forgot');
	}, [router]);

	return (
		<div className="min-h-[100dvh] flex items-center justify-center bg-background">
			<div className="text-center">
				<Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
				<p className="text-muted-foreground">Redirecting...</p>
			</div>
		</div>
	);
}

export default function ForgotPasswordPage() {
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
			<ForgotPasswordRedirect />
		</Suspense>
	);
}
