'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Loader2, Users, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

function JoinPageContent() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const { data: session, status } = useSession();
	const [isJoining, setIsJoining] = useState(false);
	const [joinResult, setJoinResult] = useState<{
		success: boolean;
		message: string;
		circleName?: string;
		circleId?: string;
	} | null>(null);

	const code = searchParams.get('code');

	useEffect(() => {
		// If not authenticated, redirect to login with return URL
		if (status === 'unauthenticated') {
			const returnUrl = `/join?code=${code}`;
			router.push(`/login?callbackUrl=${encodeURIComponent(returnUrl)}`);
			return;
		}

		// If authenticated and we have a code, attempt to join
		if (status === 'authenticated' && code && !joinResult && !isJoining) {
			handleJoin();
		}
	}, [status, code]);

	const handleJoin = async () => {
		if (!code) return;

		setIsJoining(true);
		try {
			const response = await fetch('/api/circles/join', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					code: code.toUpperCase(),
					joinType: 'LINK',
				}),
			});

			const data = await response.json();

			if (!response.ok) {
				setJoinResult({
					success: false,
					message: data.error || 'Failed to join circle',
				});
				return;
			}

			setJoinResult({
				success: true,
				message: data.message || 'Successfully joined circle!',
				circleName: data.name,
				circleId: data.id,
			});
		} catch (error) {
			console.error('Error joining circle:', error);
			setJoinResult({
				success: false,
				message: 'An error occurred while joining. Please try again.',
			});
		} finally {
			setIsJoining(false);
		}
	};

	// Loading state while checking auth
	if (status === 'loading') {
		return (
			<div className="min-h-screen flex items-center justify-center bg-background">
				<div className="text-center">
					<Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
					<p className="text-muted-foreground">Checking authentication...</p>
				</div>
			</div>
		);
	}

	// No code provided
	if (!code) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-background p-4">
				<div className="max-w-md w-full text-center">
					<div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
						<XCircle className="w-8 h-8 text-destructive" />
					</div>
					<h1 className="text-2xl font-bold text-foreground mb-2">Invalid Invite Link</h1>
					<p className="text-muted-foreground mb-6">
						This invite link is missing a valid code. Please check the link and try again.
					</p>
					<div className="flex flex-col sm:flex-row gap-3 justify-center">
						<Button onClick={() => router.push('/dashboard')} variant="outline">
							Go to Dashboard
						</Button>
						<Button onClick={() => router.push('/login')}>Sign In</Button>
					</div>
				</div>
			</div>
		);
	}

	// Joining in progress
	if (isJoining) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-background">
				<div className="text-center">
					<Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
					<h1 className="text-xl font-semibold text-foreground mb-2">Joining Circle...</h1>
					<p className="text-muted-foreground">Please wait while we add you to the circle</p>
				</div>
			</div>
		);
	}

	// Join result - Success
	if (joinResult?.success) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-background p-4">
				<div className="max-w-md w-full text-center">
					<div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
						<CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
					</div>
					<h1 className="text-2xl font-bold text-foreground mb-2">Welcome to the Circle!</h1>
					<p className="text-muted-foreground mb-2">{joinResult.message}</p>
					{joinResult.circleName && (
						<div className="bg-muted rounded-lg p-4 mb-6 inline-flex items-center gap-2">
							<Users className="w-5 h-5 text-primary" />
							<span className="font-medium text-foreground">{joinResult.circleName}</span>
						</div>
					)}
					<div className="flex flex-col sm:flex-row gap-3 justify-center">
						<Button onClick={() => router.push('/dashboard')} variant="outline">
							Go to Dashboard
						</Button>
						{joinResult.circleId && <Button onClick={() => router.push('/dashboard')}>View Circle</Button>}
					</div>
				</div>
			</div>
		);
	}

	// Join result - Error
	if (joinResult && !joinResult.success) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-background p-4">
				<div className="max-w-md w-full text-center">
					<div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
						<XCircle className="w-8 h-8 text-destructive" />
					</div>
					<h1 className="text-2xl font-bold text-foreground mb-2">Couldn&apos;t Join Circle</h1>
					<p className="text-muted-foreground mb-6">{joinResult.message}</p>
					<div className="flex flex-col sm:flex-row gap-3 justify-center">
						<Button onClick={() => router.push('/dashboard')} variant="outline">
							Go to Dashboard
						</Button>
						<Button onClick={handleJoin}>Try Again</Button>
					</div>
				</div>
			</div>
		);
	}

	// Default loading state
	return (
		<div className="min-h-screen flex items-center justify-center bg-background">
			<div className="text-center">
				<Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
				<p className="text-muted-foreground">Processing invite...</p>
			</div>
		</div>
	);
}

export default function JoinPage() {
	return (
		<Suspense
			fallback={
				<div className="min-h-screen flex items-center justify-center bg-background">
					<div className="text-center">
						<Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
						<p className="text-muted-foreground">Loading...</p>
					</div>
				</div>
			}
		>
			<JoinPageContent />
		</Suspense>
	);
}
