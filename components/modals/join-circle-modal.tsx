'use client';

import { useState, useEffect } from 'react';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle2, Users } from 'lucide-react';

interface CircleMemberPreview {
	id: string;
	name: string | null;
	image: string | null;
}

interface Circle {
	id: string;
	name: string;
	description: string | null;
	inviteCode: string;
	avatarUrl: string | null;
	createdAt: string;
	updatedAt: string;
	createdBy: {
		id: string;
		name: string | null;
		image: string | null;
	};
	membersCount: number;
	userRole: 'ADMIN' | 'MEMBER' | null;
	memberPreviews: CircleMemberPreview[];
}

interface JoinCircleModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onJoinSuccess?: (circle: Circle) => void;
	initialCode?: string;
}

export function JoinCircleModal({ open, onOpenChange, onJoinSuccess, initialCode }: JoinCircleModalProps) {
	const [code, setCode] = useState(initialCode || '');
	const [linkInput, setLinkInput] = useState('');
	const [error, setError] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	const [joinedCircle, setJoinedCircle] = useState<Circle | null>(null);
	const [activeTab, setActiveTab] = useState<'code' | 'link'>('code');

	// Update code when initialCode changes
	useEffect(() => {
		if (initialCode) {
			setCode(initialCode);
		}
	}, [initialCode]);

	const extractCodeFromLink = (link: string): string | null => {
		try {
			const url = new URL(link);
			const codeParam = url.searchParams.get('code');
			if (codeParam) return codeParam.toUpperCase();

			const pathMatch = url.pathname.match(/\/join\/([A-Z0-9]+)/i);
			if (pathMatch) return pathMatch[1].toUpperCase();

			return null;
		} catch {
			const trimmed = link.trim().toUpperCase();
			if (/^[A-Z0-9]{6,10}$/.test(trimmed)) {
				return trimmed;
			}
			return null;
		}
	};

	const handleJoin = async (joinType: 'CODE' | 'LINK') => {
		const codeToUse = joinType === 'CODE' ? code.trim() : extractCodeFromLink(linkInput.trim());

		if (!codeToUse) {
			setError(
				joinType === 'CODE' ? 'Please enter a valid join code' : 'Please enter a valid invite link or code',
			);
			return;
		}

		if (codeToUse.length < 6) {
			setError('Join code must be at least 6 characters');
			return;
		}

		setIsLoading(true);
		setError('');

		try {
			const response = await fetch('/api/circles/join', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					code: codeToUse,
					joinType,
				}),
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || 'Failed to join circle');
			}

			setJoinedCircle(data);
		} catch (err) {
			console.error('Error joining circle:', err);
			setError(
				err instanceof Error ? err.message : 'Failed to join circle. Please check the code and try again.',
			);
		} finally {
			setIsLoading(false);
		}
	};

	const handleClose = () => {
		if (joinedCircle && onJoinSuccess) {
			onJoinSuccess({
				...joinedCircle,
				avatarUrl: joinedCircle.avatarUrl || null,
				updatedAt: joinedCircle.updatedAt || joinedCircle.createdAt,
				memberPreviews: [],
			});
		}
		// Reset state
		setCode('');
		setLinkInput('');
		setError('');
		setJoinedCircle(null);
		setActiveTab('code');
		onOpenChange(false);
	};

	// Render success state
	if (joinedCircle) {
		return (
			<Dialog open={open} onOpenChange={handleClose}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
							<CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
						</div>
						<DialogTitle className="text-center">Welcome!</DialogTitle>
						<DialogDescription className="text-center">
							You&apos;ve successfully joined the circle
						</DialogDescription>
					</DialogHeader>

					<div className="rounded-lg border bg-muted/50 p-4">
						<h3 className="font-semibold">{joinedCircle.name}</h3>
						<p className="mt-1 text-sm text-muted-foreground">
							{joinedCircle.description || 'No description'}
						</p>
						<div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
							<Users className="h-4 w-4" />
							<span>{joinedCircle.membersCount} members</span>
						</div>
					</div>

					<DialogFooter className="mt-4">
						<Button onClick={handleClose} className="w-full">
							View Circle
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		);
	}

	// Render join form
	return (
		<Dialog open={open} onOpenChange={handleClose}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Join a Circle</DialogTitle>
					<DialogDescription>Enter an invite code or paste a link to join a circle</DialogDescription>
				</DialogHeader>

				<Tabs value={activeTab} onValueChange={v => setActiveTab(v as 'code' | 'link')} className="w-full">
					<TabsList className="grid w-full grid-cols-2">
						<TabsTrigger value="code">Join Code</TabsTrigger>
						<TabsTrigger value="link">Paste Link</TabsTrigger>
					</TabsList>

					<TabsContent value="code" className="mt-4 space-y-4">
						<div className="space-y-2">
							<Label htmlFor="code">Invite Code</Label>
							<Input
								id="code"
								placeholder="e.g., ABC123XY"
								value={code}
								onChange={e => {
									setCode(e.target.value.toUpperCase());
									setError('');
								}}
								className="font-mono text-lg uppercase tracking-wider"
								disabled={isLoading}
								maxLength={10}
							/>
							<p className="text-xs text-muted-foreground">Ask the circle creator for the invite code</p>
						</div>

						{error && activeTab === 'code' && (
							<Alert variant="destructive">
								<AlertDescription>{error}</AlertDescription>
							</Alert>
						)}

						<DialogFooter className="gap-2 sm:gap-0">
							<Button variant="outline" onClick={handleClose} disabled={isLoading}>
								Cancel
							</Button>
							<Button onClick={() => handleJoin('CODE')} disabled={isLoading || !code.trim()}>
								{isLoading ? (
									<>
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										Joining...
									</>
								) : (
									'Join Circle'
								)}
							</Button>
						</DialogFooter>
					</TabsContent>

					<TabsContent value="link" className="mt-4 space-y-4">
						<div className="space-y-2">
							<Label htmlFor="link">Invite Link</Label>
							<Input
								id="link"
								placeholder="https://sharecircle.com/join?code=ABC123"
								value={linkInput}
								onChange={e => {
									setLinkInput(e.target.value);
									setError('');
								}}
								className="text-sm"
								disabled={isLoading}
							/>
							<p className="text-xs text-muted-foreground">Paste the invite link you received</p>
						</div>

						{error && activeTab === 'link' && (
							<Alert variant="destructive">
								<AlertDescription>{error}</AlertDescription>
							</Alert>
						)}

						<DialogFooter className="gap-2 sm:gap-0">
							<Button variant="outline" onClick={handleClose} disabled={isLoading}>
								Cancel
							</Button>
							<Button onClick={() => handleJoin('LINK')} disabled={isLoading || !linkInput.trim()}>
								{isLoading ? (
									<>
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										Joining...
									</>
								) : (
									'Join Circle'
								)}
							</Button>
						</DialogFooter>
					</TabsContent>
				</Tabs>
			</DialogContent>
		</Dialog>
	);
}
