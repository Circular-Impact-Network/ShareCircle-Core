'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Link2, Users, Calendar, ArrowRight, LayoutGrid, List, Shield, Crown } from 'lucide-react';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreateCircleModal } from '@/components/modals/create-circle-modal';
import { JoinCircleModal } from '@/components/modals/join-circle-modal';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { PageHeader, PageShell, PageStickyHeader } from '@/components/ui/page';
import { CircleGridSkeleton } from '@/components/ui/skeletons';
import { useGetCirclesQuery, type Circle } from '@/lib/redux/api/circlesApi';

interface CircleMemberPreview {
	id: string;
	name: string | null;
	image: string | null;
}

export function CirclesPage() {
	const router = useRouter();
	const [showCreateModal, setShowCreateModal] = useState(false);
	const [showJoinModal, setShowJoinModal] = useState(false);
	const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
	const { toast } = useToast();
	const isDesktop = useMediaQuery('(min-width: 640px)');
	const effectiveViewMode = isDesktop ? viewMode : 'list';

	// Use RTK Query for circles data
	const { data: circles = [], isLoading } = useGetCirclesQuery();

	const handleCircleCreated = (newCircle: Circle) => {
		// RTK Query will automatically refetch and update the cache
		setShowCreateModal(false);
		toast({
			title: 'Circle created!',
			description: `${newCircle.name} has been created successfully.`,
		});
	};

	const handleJoinSuccess = (circle: Circle) => {
		// RTK Query will automatically refetch and update the cache
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
			<PageStickyHeader className="pt-2 sm:pt-6 lg:pt-7 pb-3 space-y-2 sm:space-y-4">
				{/* Mobile: title + buttons on same row */}
				<div className="flex items-center justify-between gap-2 sm:hidden">
					<h1 className="text-xl font-semibold tracking-tight truncate">My Circles</h1>
					<div className="flex shrink-0 items-center gap-1.5">
						<Button
							onClick={() => setShowCreateModal(true)}
							className="gap-1.5 shadow-md"
							size="sm"
						>
							<Plus className="w-4 h-4" />
							Create
						</Button>
						<Button
							onClick={() => setShowJoinModal(true)}
							variant="outline"
							size="sm"
							className="gap-1.5 bg-transparent"
						>
							<Link2 className="w-4 h-4" />
							Join
						</Button>
					</div>
				</div>
				<p className="text-sm text-muted-foreground sm:hidden">
					Join communities and share items with friends
				</p>

				{/* Desktop: original full layout */}
				<div className="hidden sm:block">
					<PageHeader
						title="My Circles"
						description="Join communities and share items with friends"
						actions={
							<div className="flex flex-wrap items-center gap-2">
								<div className="flex gap-2">
									<Button
										onClick={() => setShowCreateModal(true)}
										className="gap-2 shadow-md hover:shadow-lg transition-all duration-200"
										size="sm"
									>
										<Plus className="w-4 h-4" />
										Create Circle
									</Button>
									<Button
										onClick={() => setShowJoinModal(true)}
										variant="outline"
										size="sm"
										className="gap-2 bg-transparent transition-all duration-200"
									>
										<Link2 className="w-4 h-4" />
										Join via Code
									</Button>
								</div>
								<div className="flex items-center gap-1 rounded-lg bg-muted p-1">
									<Button
										variant={effectiveViewMode === 'grid' ? 'default' : 'ghost'}
										size="sm"
										onClick={() => setViewMode('grid')}
										className="h-8 px-3"
									>
										<LayoutGrid className="w-4 h-4" />
									</Button>
									<Button
										variant={effectiveViewMode === 'list' ? 'default' : 'ghost'}
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
				</div>
			</PageStickyHeader>

			{/* Loading State */}
			{isLoading && <CircleGridSkeleton count={6} />}

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
			{!isLoading && circles.length > 0 && effectiveViewMode === 'grid' && (
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 sm:gap-6">
					{circles.map(circle => (
						<Card
							key={circle.id}
							className="group cursor-pointer border-border/70 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 flex flex-col h-[240px]"
							onClick={() => router.push(`/circles/${circle.id}`)}
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
									<MemberAvatars members={circle.memberPreviews || []} total={circle.membersCount} />
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
							onClick={() => router.push(`/circles/${circle.id}`)}
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
											members={(circle.memberPreviews || []).slice(0, 4)}
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
