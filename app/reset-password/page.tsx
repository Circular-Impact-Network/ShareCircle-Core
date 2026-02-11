'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

function ResetPasswordRedirect() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const token = searchParams.get('token');

	useEffect(() => {
		const query = token ? `?mode=reset&token=${encodeURIComponent(token)}` : '?mode=reset';
		router.replace(`/login${query}`);
	}, [router, token]);

	return (
		<div className="min-h-[100dvh] flex items-center justify-center bg-background">
			<div className="text-center">
				<Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
				<p className="text-muted-foreground">Redirecting...</p>
			</div>
		</div>
	);
}

export default function ResetPasswordPage() {
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
			<ResetPasswordRedirect />
		</Suspense>
	);
}
