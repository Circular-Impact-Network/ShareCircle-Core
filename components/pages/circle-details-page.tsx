'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
	Copy,
	Share2,
	Plus,
	ArrowLeft,
	Crown,
	Shield,
	MoreVertical,
	RefreshCw,
	Settings,
	UserMinus,
	UserPlus,
	LogOut,
	Loader2,
	Check,
	Calendar,
	Link2,
	Users,
	ChevronLeft,
	ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ItemDetailsModal } from '@/components/modals/item-details-modal';
import { AddItemModal } from '@/components/modals/add-item-modal';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { CircleSettingsDialog } from '@/components/dialogs/circle-settings-dialog';

interface CircleDetailsPageProps {
	circleId: string;
	onBack: () => void;
}

interface Member {
	id: string;
	userId: string;
	name: string | null;
	email: string | null;
	image: string | null;
	role: 'ADMIN' | 'MEMBER';
	joinType: 'CREATED' | 'CODE' | 'LINK';
	joinedAt: string;
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
		email: string | null;
	};
	membersCount: number;
	userRole: 'ADMIN' | 'MEMBER';
	members: Member[];
}

interface Item {
	id: number;
	title: string;
	description: string;
	image: string;
	postedBy: { name: string; avatar: string };
	availability: string;
	tags: string[];
}

export function CircleDetailsPage({ circleId, onBack }: CircleDetailsPageProps) {
	const { data: session } = useSession();
	const [circle, setCircle] = useState<Circle | null>(null);
	const [selectedItem, setSelectedItem] = useState<Item | null>(null);
	const [showAddItem, setShowAddItem] = useState(false);
	const [showSettings, setShowSettings] = useState(false);
	const [showInviteSection, setShowInviteSection] = useState(false);
	const [copied, setCopied] = useState<'code' | 'link' | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isRegeneratingCode, setIsRegeneratingCode] = useState(false);
	const [selectedMember, setSelectedMember] = useState<Member | null>(null);
	const [memberAction, setMemberAction] = useState<'promote' | 'demote' | 'remove' | 'leave' | null>(null);
	const [isProcessingMember, setIsProcessingMember] = useState(false);
	const membersScrollRef = useRef<HTMLDivElement>(null);
	const { toast } = useToast();

	const fetchCircle = useCallback(async () => {
		try {
			setIsLoading(true);
			const response = await fetch(`/api/circles/${circleId}`);
			if (!response.ok) {
				if (response.status === 403) {
					toast({
						title: 'Access Denied',
						description: 'You are not a member of this circle.',
						variant: 'destructive',
					});
					onBack();
					return;
				}
				throw new Error('Failed to fetch circle');
			}
			const data = await response.json();
			setCircle(data);
		} catch (error) {
			console.error('Error fetching circle:', error);
			toast({
				title: 'Error',
				description: 'Failed to load circle details.',
				variant: 'destructive',
			});
		} finally {
			setIsLoading(false);
		}
	}, [circleId, toast, onBack]);

	useEffect(() => {
		fetchCircle();
	}, [fetchCircle]);

	const handleCopy = async (text: string, type: 'code' | 'link') => {
		try {
			await navigator.clipboard.writeText(text);
			setCopied(type);
			setTimeout(() => setCopied(null), 2000);
		} catch {
			toast({
				title: 'Failed to copy',
				description: 'Please try again or copy manually.',
				variant: 'destructive',
			});
		}
	};

	const handleRegenerateCode = async () => {
		if (!circle || circle.userRole !== 'ADMIN') return;

		try {
			setIsRegeneratingCode(true);
			const response = await fetch(`/api/circles/${circleId}/regenerate-code`, {
				method: 'POST',
			});

			if (!response.ok) throw new Error('Failed to regenerate code');

			const data = await response.json();
			setCircle(prev => (prev ? { ...prev, inviteCode: data.inviteCode } : null));
			toast({
				title: 'Code regenerated',
				description: 'A new invite code has been generated.',
			});
		} catch (error) {
			console.error('Error regenerating code:', error);
			toast({
				title: 'Error',
				description: 'Failed to regenerate invite code.',
				variant: 'destructive',
			});
		} finally {
			setIsRegeneratingCode(false);
		}
	};

	const handleMemberAction = async () => {
		if (!selectedMember || !memberAction || !circle) return;

		setIsProcessingMember(true);
		try {
			if (memberAction === 'promote' || memberAction === 'demote') {
				const newRole = memberAction === 'promote' ? 'ADMIN' : 'MEMBER';
				const response = await fetch(`/api/circles/${circleId}/members/${selectedMember.userId}`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ role: newRole }),
				});

				if (!response.ok) {
					const error = await response.json();
					throw new Error(error.error || 'Failed to update role');
				}

				setCircle(prev => {
					if (!prev) return null;
					return {
						...prev,
						members: prev.members.map(m =>
							m.userId === selectedMember.userId ? { ...m, role: newRole } : m,
						),
					};
				});

				toast({
					title: 'Role updated',
					description: `${selectedMember.name || 'Member'} is now ${
						newRole === 'ADMIN' ? 'an admin' : 'a member'
					}.`,
				});
			} else if (memberAction === 'remove' || memberAction === 'leave') {
				const response = await fetch(`/api/circles/${circleId}/members/${selectedMember.userId}`, {
					method: 'DELETE',
				});

				if (!response.ok) {
					const error = await response.json();
					throw new Error(error.error || 'Failed to remove member');
				}

				if (memberAction === 'leave') {
					toast({
						title: 'Left circle',
						description: 'You have left this circle.',
					});
					onBack();
					return;
				}

				setCircle(prev => {
					if (!prev) return null;
					return {
						...prev,
						members: prev.members.filter(m => m.userId !== selectedMember.userId),
						membersCount: prev.membersCount - 1,
					};
				});

				toast({
					title: 'Member removed',
					description: `${selectedMember.name || 'Member'} has been removed from the circle.`,
				});
			}
		} catch (error) {
			console.error('Error processing member action:', error);
			toast({
				title: 'Error',
				description: error instanceof Error ? error.message : 'Failed to process action.',
				variant: 'destructive',
			});
		} finally {
			setIsProcessingMember(false);
			setSelectedMember(null);
			setMemberAction(null);
		}
	};

	const getInitials = (name: string | null) => {
		if (!name) return '?';
		return name
			.split(' ')
			.map(n => n[0])
			.join('')
			.toUpperCase()
			.slice(0, 2);
	};

	const formatDate = (dateString: string) => {
		return new Date(dateString).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
		});
	};

	const getJoinTypeLabel = (joinType: string) => {
		switch (joinType) {
			case 'CREATED':
				return 'Creator';
			case 'CODE':
				return 'Joined via code';
			case 'LINK':
				return 'Joined via link';
			default:
				return joinType;
		}
	};

	const getShareUrl = () => {
		if (typeof window !== 'undefined' && circle) {
			return `${window.location.origin}/join?code=${circle.inviteCode}`;
		}
		return '';
	};

	// Loading state
	if (isLoading) {
		return (
			<div className="flex flex-col items-center justify-center min-h-[60vh]">
				<Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
				<p className="text-muted-foreground">Loading circle details...</p>
			</div>
		);
	}

	// Not found state
	if (!circle) {
		return (
			<div className="p-4 sm:p-6 lg:p-8">
				<Button onClick={onBack} variant="ghost" className="mb-4 gap-2">
					<ArrowLeft className="h-4 w-4" />
					Back to Circles
				</Button>
				<Alert variant="destructive">
					<AlertDescription>Circle not found or you don&apos;t have access.</AlertDescription>
				</Alert>
			</div>
		);
	}

	const isAdmin = circle?.userRole === 'ADMIN';
	const currentUserId = session?.user?.id;

	const scrollMembers = (direction: 'left' | 'right') => {
		if (membersScrollRef.current) {
			const scrollAmount = 280;
			membersScrollRef.current.scrollBy({
				left: direction === 'left' ? -scrollAmount : scrollAmount,
				behavior: 'smooth',
			});
		}
	};

	return (
		<div className="p-4 sm:p-6 lg:p-8">
			{/* Back Button */}
			<Button onClick={onBack} variant="ghost" className="-ml-2 mb-4 gap-2 sm:mb-6">
				<ArrowLeft className="h-4 w-4" />
				<span className="hidden sm:inline">Back to Circles</span>
				<span className="sm:hidden">Back</span>
			</Button>

			{/* Compact Circle Header */}
			<div className="mb-6 sm:mb-8">
				<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
					{/* Left: Avatar + Info */}
					<div className="flex items-start gap-4">
						{/* Circle Avatar */}
						<div className="flex h-16 w-16 sm:h-20 sm:w-20 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-border/50 overflow-hidden">
							{circle.avatarUrl ? (
								<img src={circle.avatarUrl} alt={circle.name} className="h-full w-full object-cover" />
							) : (
								<Users className="h-8 w-8 sm:h-10 sm:w-10 text-primary" />
							)}
						</div>

						<div className="min-w-0 flex-1">
							<div className="flex items-center gap-2 flex-wrap">
								<h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground">
									{circle.name}
								</h1>
								{isAdmin && (
									<Badge
										variant="secondary"
										className="gap-1 shrink-0 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
									>
										<Crown className="h-3 w-3" />
										Admin
									</Badge>
								)}
							</div>
							<p className="text-sm sm:text-base text-muted-foreground mt-1 line-clamp-2">
								{circle.description || 'No description'}
							</p>

							{/* Inline Stats */}
							<div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
								<span className="inline-flex items-center gap-1.5">
									<Users className="h-4 w-4" />
									{circle.membersCount} {circle.membersCount === 1 ? 'member' : 'members'}
								</span>
								<span className="inline-flex items-center gap-1.5">
									<Calendar className="h-4 w-4" />
									{formatDate(circle.createdAt)}
								</span>
							</div>
						</div>
					</div>

					{/* Right: Action Buttons */}
					<div className="flex gap-2 flex-shrink-0">
						{isAdmin && (
							<Button variant="outline" size="sm" className="gap-2" onClick={() => setShowSettings(true)}>
								<Settings className="h-4 w-4" />
								<span className="hidden sm:inline">Settings</span>
							</Button>
						)}
						<Button
							variant="outline"
							size="sm"
							className="gap-2"
							onClick={() => setShowInviteSection(!showInviteSection)}
						>
							<Share2 className="h-4 w-4" />
							<span className="hidden sm:inline">Invite</span>
						</Button>
					</div>
				</div>

				{/* Collapsible Invite Section */}
				{showInviteSection && (
					<Card className="mt-4 border-border/70 bg-muted/30">
						<CardContent className="p-4">
							<div className="flex flex-col gap-4 sm:flex-row sm:items-center">
								{/* Invite Code */}
								<div className="flex-1">
									<div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
										<Link2 className="h-3 w-3" />
										Invite Code
									</div>
									<div className="flex items-center gap-2">
										<code className="font-mono text-lg sm:text-xl font-bold tracking-widest text-foreground">
											{circle.inviteCode}
										</code>
										<Button
											variant="ghost"
											size="sm"
											className="h-8 w-8 p-0"
											onClick={() => handleCopy(circle.inviteCode, 'code')}
										>
											{copied === 'code' ? (
												<Check className="h-4 w-4 text-emerald-500" />
											) : (
												<Copy className="h-4 w-4" />
											)}
										</Button>
										{isAdmin && (
											<Button
												variant="ghost"
												size="sm"
												className="h-8 w-8 p-0"
												onClick={handleRegenerateCode}
												disabled={isRegeneratingCode}
											>
												{isRegeneratingCode ? (
													<Loader2 className="h-4 w-4 animate-spin" />
												) : (
													<RefreshCw className="h-4 w-4" />
												)}
											</Button>
										)}
									</div>
								</div>

								<Separator orientation="vertical" className="hidden sm:block h-12" />
								<Separator className="sm:hidden" />

								{/* Share Link */}
								<div className="flex-1">
									<div className="text-xs text-muted-foreground mb-1">Share Link</div>
									<div className="flex items-center gap-2">
										<code className="flex-1 text-sm text-primary truncate bg-muted/50 px-2 py-1 rounded">
											{getShareUrl()}
										</code>
										<Button
											variant="secondary"
											size="sm"
											className="shrink-0 gap-1"
											onClick={() => handleCopy(getShareUrl(), 'link')}
										>
											{copied === 'link' ? (
												<>
													<Check className="h-3 w-3" />
													<span className="hidden sm:inline">Copied</span>
												</>
											) : (
												<>
													<Copy className="h-3 w-3" />
													<span className="hidden sm:inline">Copy</span>
												</>
											)}
										</Button>
									</div>
								</div>
							</div>
						</CardContent>
					</Card>
				)}
			</div>

			{/* Members Section - Horizontal Carousel on Desktop, Stack on Mobile */}
			<div className="mb-6 sm:mb-8">
				<div className="mb-4 flex items-center justify-between">
					<div className="flex items-center gap-3">
						<h2 className="text-xl font-semibold sm:text-2xl">Members</h2>
						<Badge variant="outline" className="text-xs">
							{circle.members.length}
						</Badge>
					</div>

					{/* Carousel Navigation - Hidden on Mobile */}
					<div className="hidden sm:flex items-center gap-1">
						<Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => scrollMembers('left')}>
							<ChevronLeft className="h-4 w-4" />
						</Button>
						<Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => scrollMembers('right')}>
							<ChevronRight className="h-4 w-4" />
						</Button>
					</div>
				</div>

				{/* Desktop: Horizontal Scroll Carousel */}
				<div
					ref={membersScrollRef}
					className="hidden sm:flex gap-4 overflow-x-auto pb-2 scroll-smooth snap-x snap-mandatory scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent"
					style={{ scrollbarWidth: 'thin' }}
				>
					{circle.members.map(member => {
						const isCurrentUser = member.userId === currentUserId;
						const canManage = isAdmin && !isCurrentUser;
						const isCreator = member.joinType === 'CREATED';

						return (
							<Card key={member.id} className="group flex-shrink-0 w-[260px] border-border/70 snap-start">
								<CardContent className="flex items-start gap-3 p-4">
									<Tooltip>
										<TooltipTrigger asChild>
											<Avatar className="h-11 w-11 flex-shrink-0">
												<AvatarImage
													src={member.image || undefined}
													alt={member.name || 'Member'}
												/>
												<AvatarFallback className="text-sm">
													{getInitials(member.name)}
												</AvatarFallback>
											</Avatar>
										</TooltipTrigger>
										<TooltipContent>{member.name || member.email || 'Member'}</TooltipContent>
									</Tooltip>

									<div className="min-w-0 flex-1 space-y-0.5">
										<div className="flex items-center gap-1.5">
											<h3 className="truncate text-sm font-semibold">
												{member.name || 'Unknown'}
												{isCurrentUser && (
													<span className="font-normal text-muted-foreground"> (you)</span>
												)}
											</h3>
										</div>
										<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
											{member.role === 'ADMIN' ? (
												<span className="inline-flex items-center gap-1 text-amber-500">
													<Crown className="h-3 w-3" />
													Admin
												</span>
											) : (
												<span className="inline-flex items-center gap-1">
													<Shield className="h-3 w-3" />
													Member
												</span>
											)}
										</div>
										<p className="text-xs text-muted-foreground">{formatDate(member.joinedAt)}</p>
									</div>

									{(canManage || isCurrentUser) && (
										<DropdownMenu>
											<DropdownMenuTrigger asChild>
												<Button
													variant="ghost"
													size="sm"
													className="h-7 w-7 p-0 opacity-0 transition-opacity group-hover:opacity-100"
												>
													<MoreVertical className="h-4 w-4" />
													<span className="sr-only">Open menu</span>
												</Button>
											</DropdownMenuTrigger>
											<DropdownMenuContent align="end">
												{canManage && (
													<>
														{member.role === 'MEMBER' && (
															<DropdownMenuItem
																onClick={() => {
																	setSelectedMember(member);
																	setMemberAction('promote');
																}}
															>
																<UserPlus className="mr-2 h-4 w-4" />
																Make Admin
															</DropdownMenuItem>
														)}
														{member.role === 'ADMIN' && !isCreator && (
															<DropdownMenuItem
																onClick={() => {
																	setSelectedMember(member);
																	setMemberAction('demote');
																}}
															>
																<UserMinus className="mr-2 h-4 w-4" />
																Remove Admin
															</DropdownMenuItem>
														)}
														<DropdownMenuSeparator />
														<DropdownMenuItem
															className="text-destructive focus:text-destructive"
															onClick={() => {
																setSelectedMember(member);
																setMemberAction('remove');
															}}
														>
															<UserMinus className="mr-2 h-4 w-4" />
															Remove from Circle
														</DropdownMenuItem>
													</>
												)}
												{isCurrentUser && (
													<DropdownMenuItem
														className="text-destructive focus:text-destructive"
														onClick={() => {
															setSelectedMember(member);
															setMemberAction('leave');
														}}
													>
														<LogOut className="mr-2 h-4 w-4" />
														Leave Circle
													</DropdownMenuItem>
												)}
											</DropdownMenuContent>
										</DropdownMenu>
									)}
								</CardContent>
							</Card>
						);
					})}
				</div>

				{/* Mobile: Vertical Stack */}
				<div className="sm:hidden space-y-3">
					{circle.members.map(member => {
						const isCurrentUser = member.userId === currentUserId;
						const canManage = isAdmin && !isCurrentUser;
						const isCreator = member.joinType === 'CREATED';

						return (
							<Card key={member.id} className="group border-border/70">
								<CardContent className="flex items-center gap-3 p-3">
									<Avatar className="h-10 w-10 flex-shrink-0">
										<AvatarImage src={member.image || undefined} alt={member.name || 'Member'} />
										<AvatarFallback className="text-sm">{getInitials(member.name)}</AvatarFallback>
									</Avatar>

									<div className="min-w-0 flex-1">
										<div className="flex items-center gap-1.5">
											<h3 className="truncate text-sm font-semibold">
												{member.name || 'Unknown'}
												{isCurrentUser && (
													<span className="font-normal text-muted-foreground"> (you)</span>
												)}
											</h3>
											{member.role === 'ADMIN' && (
												<Crown className="h-3 w-3 text-amber-500 flex-shrink-0" />
											)}
										</div>
										<p className="text-xs text-muted-foreground">{formatDate(member.joinedAt)}</p>
									</div>

									{(canManage || isCurrentUser) && (
										<DropdownMenu>
											<DropdownMenuTrigger asChild>
												<Button variant="ghost" size="sm" className="h-8 w-8 p-0">
													<MoreVertical className="h-4 w-4" />
													<span className="sr-only">Open menu</span>
												</Button>
											</DropdownMenuTrigger>
											<DropdownMenuContent align="end">
												{canManage && (
													<>
														{member.role === 'MEMBER' && (
															<DropdownMenuItem
																onClick={() => {
																	setSelectedMember(member);
																	setMemberAction('promote');
																}}
															>
																<UserPlus className="mr-2 h-4 w-4" />
																Make Admin
															</DropdownMenuItem>
														)}
														{member.role === 'ADMIN' && !isCreator && (
															<DropdownMenuItem
																onClick={() => {
																	setSelectedMember(member);
																	setMemberAction('demote');
																}}
															>
																<UserMinus className="mr-2 h-4 w-4" />
																Remove Admin
															</DropdownMenuItem>
														)}
														<DropdownMenuSeparator />
														<DropdownMenuItem
															className="text-destructive focus:text-destructive"
															onClick={() => {
																setSelectedMember(member);
																setMemberAction('remove');
															}}
														>
															<UserMinus className="mr-2 h-4 w-4" />
															Remove
														</DropdownMenuItem>
													</>
												)}
												{isCurrentUser && (
													<DropdownMenuItem
														className="text-destructive focus:text-destructive"
														onClick={() => {
															setSelectedMember(member);
															setMemberAction('leave');
														}}
													>
														<LogOut className="mr-2 h-4 w-4" />
														Leave Circle
													</DropdownMenuItem>
												)}
											</DropdownMenuContent>
										</DropdownMenu>
									)}
								</CardContent>
							</Card>
						);
					})}
				</div>

				{/* Leave Circle Button (for non-creators) */}
				{!circle.members.find(m => m.userId === currentUserId && m.joinType === 'CREATED') && (
					<div className="mt-4 pt-4 border-t border-border/60">
						<Button
							variant="ghost"
							size="sm"
							className="gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
							onClick={() => {
								const currentMember = circle.members.find(m => m.userId === currentUserId);
								if (currentMember) {
									setSelectedMember(currentMember);
									setMemberAction('leave');
								}
							}}
						>
							<LogOut className="h-4 w-4" />
							Leave Circle
						</Button>
					</div>
				)}
			</div>

			{/* Items Section - Placeholder for now */}
			<Card className="mb-8 border-dashed border-border/70 bg-card">
				<CardHeader className="flex flex-row items-center justify-between">
					<CardTitle className="text-2xl">Shared Items</CardTitle>
					<Button onClick={() => setShowAddItem(true)} className="gap-2" size="sm">
						<Plus className="h-4 w-4" />
						<span className="hidden sm:inline">Add Item</span>
						<span className="sm:hidden">Add</span>
					</Button>
				</CardHeader>
				<CardContent className="flex flex-col items-center gap-4 text-center">
					<div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-border/80">
						<Plus className="h-6 w-6 text-muted-foreground" />
					</div>
					<p className="text-sm text-muted-foreground">No items shared yet</p>
					<Button onClick={() => setShowAddItem(true)} variant="outline" className="gap-2">
						<Plus className="h-4 w-4" />
						Add the first item
					</Button>
				</CardContent>
			</Card>

			{/* Member Action Confirmation Dialog */}
			<Dialog
				open={!!memberAction}
				onOpenChange={open => {
					if (!open) {
						setMemberAction(null);
						setSelectedMember(null);
					}
				}}
			>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>
							{memberAction === 'promote' && 'Make Admin'}
							{memberAction === 'demote' && 'Remove Admin Role'}
							{memberAction === 'remove' && 'Remove Member'}
							{memberAction === 'leave' && 'Leave Circle'}
						</DialogTitle>
						<DialogDescription>
							{memberAction === 'promote' &&
								`Make ${
									selectedMember?.name || 'this member'
								} an admin? They will be able to manage members and circle settings.`}
							{memberAction === 'demote' &&
								`Remove admin role from ${
									selectedMember?.name || 'this member'
								}? They will become a regular member.`}
							{memberAction === 'remove' &&
								`Remove ${
									selectedMember?.name || 'this member'
								} from the circle? They will need to rejoin using the invite code.`}
							{memberAction === 'leave' &&
								"Are you sure you want to leave this circle? You'll need to rejoin using the invite code."}
						</DialogDescription>
					</DialogHeader>
					<DialogFooter className="gap-2 sm:gap-0">
						<Button
							variant="outline"
							onClick={() => {
								setMemberAction(null);
								setSelectedMember(null);
							}}
							disabled={isProcessingMember}
						>
							Cancel
						</Button>
						<Button
							variant={memberAction === 'remove' || memberAction === 'leave' ? 'destructive' : 'default'}
							onClick={handleMemberAction}
							disabled={isProcessingMember}
						>
							{isProcessingMember && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
							{memberAction === 'promote' && 'Make Admin'}
							{memberAction === 'demote' && 'Remove Admin'}
							{memberAction === 'remove' && 'Remove'}
							{memberAction === 'leave' && 'Leave'}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Modals */}
			<ItemDetailsModal item={selectedItem} onOpenChange={open => !open && setSelectedItem(null)} />
			<AddItemModal open={showAddItem} onOpenChange={setShowAddItem} />

			{/* Settings Dialog - Admin Only */}
			{isAdmin && (
				<CircleSettingsDialog
					open={showSettings}
					onOpenChange={setShowSettings}
					circle={circle}
					currentUserId={currentUserId}
					onCircleUpdated={updates => {
						setCircle(prev => (prev ? { ...prev, ...updates } : null));
					}}
					onCircleDeleted={() => {
						toast({
							title: 'Circle deleted',
							description: 'Redirecting to circles list...',
						});
						onBack();
					}}
					onMemberUpdated={member => {
						setCircle(prev => {
							if (!prev) return null;
							return {
								...prev,
								members: prev.members.map(m =>
									m.userId === member.userId ? { ...m, role: member.role } : m,
								),
							};
						});
					}}
					onMemberRemoved={userId => {
						setCircle(prev => {
							if (!prev) return null;
							return {
								...prev,
								members: prev.members.filter(m => m.userId !== userId),
								membersCount: prev.membersCount - 1,
							};
						});
					}}
					onMemberAdded={member => {
						setCircle(prev => {
							if (!prev) return null;
							return {
								...prev,
								members: [...prev.members, member],
								membersCount: prev.membersCount + 1,
							};
						});
					}}
				/>
			)}
		</div>
	);
}
