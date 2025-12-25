'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Link2, Users, Calendar, ArrowRight, LayoutGrid, List, Shield, Crown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreateCircleModal } from '@/components/modals/create-circle-modal';
import { JoinCircleModal } from '@/components/modals/join-circle-modal';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { PageHeader, PageShell } from '@/components/ui/page';

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

interface CirclesPageProps {
	onSelectCircle: (id: string) => void;
}

export function CirclesPage({ onSelectCircle }: CirclesPageProps) {
	const [showCreateModal, setShowCreateModal] = useState(false);
	const [showJoinModal, setShowJoinModal] = useState(false);
	const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
	const [circles, setCircles] = useState<Circle[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const { toast } = useToast();

	const fetchCircles = useCallback(async () => {
		try {
			setIsLoading(true);
			const response = await fetch('/api/circles');
			if (!response.ok) {
				throw new Error('Failed to fetch circles');
			}
			const data = await response.json();
			setCircles(data);
		} catch (error) {
			console.error('Error fetching circles:', error);
			toast({
				title: 'Error',
				description: 'Failed to load circles. Please try again.',
				variant: 'destructive',
			});
		} finally {
			setIsLoading(false);
		}
	}, [toast]);

	useEffect(() => {
		fetchCircles();
	}, [fetchCircles]);

	const handleCircleCreated = (newCircle: Circle) => {
		setCircles(prev => [newCircle, ...prev]);
		setShowCreateModal(false);
		toast({
			title: 'Circle created!',
			description: `${newCircle.name} has been created successfully.`,
		});
	};

	const handleJoinSuccess = (circle: Circle) => {
		setCircles(prev => {
			// Check if circle already exists (user rejoined)
			const exists = prev.find(c => c.id === circle.id);
			if (exists) {
				return prev.map(c => (c.id === circle.id ? circle : c));
			}
			return [circle, ...prev];
		});
		setShowJoinModal(false);
		toast({
			title: 'Success!',
			description: `You've joined ${circle.name}`,
		});
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

	const RoleBadge = ({ role }: { role: 'ADMIN' | 'MEMBER' | null }) => {
		if (role === 'ADMIN') {
			return (
				<Badge
					variant="secondary"
					className="gap-1 shrink-0 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
				>
					<Crown className="h-3 w-3" />
					<span className="hidden xs:inline">Admin</span>
				</Badge>
			);
		}
		if (role === 'MEMBER') {
			return (
				<Badge
					variant="secondary"
					className="gap-1 shrink-0 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
				>
					<Shield className="h-3 w-3" />
					<span className="hidden xs:inline">Member</span>
				</Badge>
			);
		}
		return null;
	};

	const MemberAvatars = ({ members, total }: { members: CircleMemberPreview[]; total: number }) => {
		const remaining = total - members.length;
		return (
			<div className="flex -space-x-2">
				{members.slice(0, 4).map((member, idx) => (
					<Tooltip key={member.id}>
						<TooltipTrigger asChild>
							<Avatar
								className="h-8 w-8 border-2 border-background ring-0"
								style={{ zIndex: members.length - idx }}
							>
								<AvatarImage src={member.image || undefined} alt={member.name || 'Member'} />
								<AvatarFallback className="text-[10px]">{getInitials(member.name)}</AvatarFallback>
							</Avatar>
						</TooltipTrigger>
						<TooltipContent>{member.name || 'Member'}</TooltipContent>
					</Tooltip>
				))}
				{remaining > 0 && (
					<div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-muted text-[10px] font-semibold text-muted-foreground">
						+{remaining}
					</div>
				)}
			</div>
		);
	};

	return (
		<PageShell className="space-y-6 sm:space-y-8">
			<PageHeader
				title="My Circles"
				description="Join communities and share items with friends"
				actions={
					<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end sm:gap-4">
						<div className="flex gap-2 sm:gap-3">
							<Button
								onClick={() => setShowCreateModal(true)}
								className="flex-1 gap-2 shadow-md hover:shadow-lg transition-all duration-200 sm:flex-none"
							>
								<Plus className="w-4 h-4" />
								<span className="hidden sm:inline">Create Circle</span>
								<span className="sm:hidden">Create</span>
							</Button>
							<Button
								onClick={() => setShowJoinModal(true)}
								variant="outline"
								className="flex-1 gap-2 bg-transparent transition-all duration-200 sm:flex-none"
							>
								<Link2 className="w-4 h-4" />
								<span className="hidden sm:inline">Join via Code</span>
								<span className="sm:hidden">Join</span>
							</Button>
						</div>
						<div className="flex items-center gap-1 rounded-lg bg-muted p-1 sm:self-auto">
							<Button
								variant={viewMode === 'grid' ? 'default' : 'ghost'}
								size="sm"
								onClick={() => setViewMode('grid')}
								className="h-8 px-3"
							>
								<LayoutGrid className="w-4 h-4" />
							</Button>
							<Button
								variant={viewMode === 'list' ? 'default' : 'ghost'}
								size="sm"
								onClick={() => setViewMode('list')}
								className="h-8 px-3"
							>
								<List className="w-4 h-4" />
							</Button>
						</div>
					</div>
				}
			/>

			{/* Loading State */}
			{isLoading && (
				<div className="flex flex-col items-center justify-center py-16">
					<Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
					<p className="text-muted-foreground">Loading your circles...</p>
				</div>
			)}

			{/* Empty State */}
			{!isLoading && circles.length === 0 && (
				<div className="flex flex-col items-center justify-center py-16 px-4 text-center">
					<div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
						<Users className="w-8 h-8 text-primary" />
					</div>
					<h3 className="text-lg font-semibold text-foreground mb-2">No circles yet</h3>
					<p className="text-muted-foreground mb-6 max-w-md">
						Create a new circle to start sharing items with friends, family, or communities you trust.
					</p>
					<div className="flex flex-col sm:flex-row gap-3">
						<Button onClick={() => setShowCreateModal(true)} className="gap-2">
							<Plus className="w-4 h-4" />
							Create your first circle
						</Button>
						<Button onClick={() => setShowJoinModal(true)} variant="outline" className="gap-2">
							<Link2 className="w-4 h-4" />
							Join with a code
						</Button>
					</div>
				</div>
			)}

			{/* Grid View */}
			{!isLoading && circles.length > 0 && viewMode === 'grid' && (
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 sm:gap-6">
					{circles.map(circle => (
						<Card
							key={circle.id}
							className="group cursor-pointer border-border/70 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 flex flex-col h-[240px]"
							onClick={() => onSelectCircle(circle.id)}
						>
							<CardHeader className="pb-0 flex-shrink-0">
								<div className="flex items-start justify-between gap-2">
									<div className="min-w-0 flex-1 space-y-1">
										<Tooltip>
											<TooltipTrigger asChild>
												<CardTitle className="text-base sm:text-lg line-clamp-1 cursor-pointer">
													{circle.name}
												</CardTitle>
											</TooltipTrigger>
											<TooltipContent side="top" className="max-w-[280px]">
												{circle.name}
											</TooltipContent>
										</Tooltip>
										<CardDescription className="line-clamp-2 text-sm h-10">
											{circle.description || 'No description'}
										</CardDescription>
									</div>
									<RoleBadge role={circle.userRole} />
								</div>
							</CardHeader>
							<CardContent className="flex flex-col flex-1 pt-4 justify-between">
								<div className="flex items-center justify-between gap-4">
									<MemberAvatars members={circle.memberPreviews} total={circle.membersCount} />
									<span className="text-xs text-muted-foreground whitespace-nowrap">
										{circle.membersCount} {circle.membersCount === 1 ? 'member' : 'members'}
									</span>
								</div>
								<div className="mt-auto pt-3">
									<Separator className="mb-3" />
									<div className="flex items-center justify-between text-xs text-muted-foreground">
										<div className="flex items-center gap-2 min-w-0">
											<Avatar className="h-7 w-7 flex-shrink-0">
												<AvatarImage src={circle.createdBy.image || undefined} />
												<AvatarFallback className="text-[10px]">
													{getInitials(circle.createdBy.name)}
												</AvatarFallback>
											</Avatar>
											<div className="min-w-0">
												<p className="truncate font-medium text-card-foreground text-sm">
													{circle.createdBy.name || 'Unknown'}
												</p>
												<p className="text-xs text-muted-foreground">
													{formatDate(circle.createdAt)}
												</p>
											</div>
										</div>
										<ArrowRight className="h-4 w-4 flex-shrink-0 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary" />
									</div>
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			)}

			{/* List View */}
			{!isLoading && circles.length > 0 && viewMode === 'list' && (
				<div className="space-y-3">
					{circles.map(circle => (
						<Card
							key={circle.id}
							className="group cursor-pointer border-border/70 transition-all hover:border-primary/40"
							onClick={() => onSelectCircle(circle.id)}
						>
							<CardContent className="flex flex-col gap-4 p-4 sm:p-5">
								<div className="flex items-start gap-3 sm:gap-4">
									<div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 overflow-hidden">
										{circle.avatarUrl ? (
											<img
												src={circle.avatarUrl}
												alt={circle.name}
												className="h-full w-full object-cover"
											/>
										) : (
											<Users className="h-5 w-5 text-primary" />
										)}
									</div>
									<div className="flex-1 min-w-0 space-y-1">
										<div className="flex items-center gap-2 min-w-0">
											<Tooltip>
												<TooltipTrigger asChild>
													<h3 className="text-base font-semibold text-card-foreground truncate flex-1 min-w-0 cursor-pointer">
														{circle.name}
													</h3>
												</TooltipTrigger>
												<TooltipContent side="top" className="max-w-[280px]">
													{circle.name}
												</TooltipContent>
											</Tooltip>
											<RoleBadge role={circle.userRole} />
										</div>
										<p className="text-sm text-muted-foreground line-clamp-1">
											{circle.description || 'No description'}
										</p>
									</div>
									<ArrowRight className="h-4 w-4 flex-shrink-0 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary" />
								</div>

								<div className="flex flex-col gap-3 border-t border-border/60 pt-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
									<div className="flex items-center gap-3">
										<MemberAvatars
											members={circle.memberPreviews.slice(0, 4)}
											total={circle.membersCount}
										/>
										<span>{circle.membersCount} members</span>
									</div>
									<div className="flex items-center gap-2 text-xs">
										<Calendar className="h-4 w-4 flex-shrink-0" />
										<span className="whitespace-nowrap">{formatDate(circle.createdAt)}</span>
										<span>•</span>
										<span className="truncate">{circle.createdBy.name || 'Unknown'}</span>
									</div>
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			)}

			{/* Modals */}
			<CreateCircleModal
				open={showCreateModal}
				onOpenChange={setShowCreateModal}
				onCircleCreated={handleCircleCreated}
			/>
			<JoinCircleModal open={showJoinModal} onOpenChange={setShowJoinModal} onJoinSuccess={handleJoinSuccess} />
		</PageShell>
	);
}
