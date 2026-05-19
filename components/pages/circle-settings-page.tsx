'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
	ArrowLeft,
	Upload,
	Trash2,
	Crown,
	Shield,
	UserPlus,
	UserMinus,
	Users,
	AlertTriangle,
	Search,
	X,
	Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PageShell } from '@/components/ui/page';
import { PageTabs, PageTabsContent, PageTabsList, PageTabsTrigger } from '@/components/ui/app-tabs';
import { useToast } from '@/hooks/useToast';
import { CircleDetailSkeleton } from '@/components/ui/skeletons';
import {
	useGetCircleQuery,
	useUpdateCircleMutation,
	useDeleteCircleMutation,
	useAddMemberMutation,
	useUpdateMemberRoleMutation,
	useRemoveMemberMutation,
	useUploadCircleAvatarMutation,
	useRemoveCircleAvatarMutation,
	type CircleMember,
} from '@/lib/redux/api/circlesApi';

interface CircleSettingsPageProps {
	circleId: string;
	defaultTab?: string;
}

const VALID_TABS = ['general', 'members', 'danger'] as const;

export function CircleSettingsPage({ circleId, defaultTab }: CircleSettingsPageProps) {
	const initialTab = VALID_TABS.includes(defaultTab as (typeof VALID_TABS)[number]) ? defaultTab! : 'general';
	const router = useRouter();
	const { toast } = useToast();
	const fileInputRef = useRef<HTMLInputElement>(null);

	const { data: circle, isLoading } = useGetCircleQuery(circleId);

	useEffect(() => {
		if (circle && circle.userRole !== 'ADMIN') {
			router.push(`/circles/${circleId}`);
		}
	}, [circle, circleId, router]);

	// General tab
	const [name, setName] = useState('');
	const [nameInitialized, setNameInitialized] = useState(false);
	const [description, setDescription] = useState('');
	const [descInitialized, setDescInitialized] = useState(false);
	const [generalError, setGeneralError] = useState('');

	if (circle && !nameInitialized) {
		setName(circle.name);
		setNameInitialized(true);
	}
	if (circle && !descInitialized) {
		setDescription(circle.description || '');
		setDescInitialized(true);
	}

	// Members tab
	const [memberSearch, setMemberSearch] = useState('');
	const [addEmail, setAddEmail] = useState('');

	// Danger zone
	const [confirmDelete, setConfirmDelete] = useState('');

	const [processingMemberId, setProcessingMemberId] = useState<string | null>(null);

	const [updateCircle, { isLoading: isSaving }] = useUpdateCircleMutation();
	const [deleteCircle, { isLoading: isDeleting }] = useDeleteCircleMutation();
	const [addMember, { isLoading: isAddingMember }] = useAddMemberMutation();
	const [updateMemberRole] = useUpdateMemberRoleMutation();
	const [removeMember] = useRemoveMemberMutation();
	const [uploadCircleAvatar, { isLoading: isUploadingAvatar }] = useUploadCircleAvatarMutation();
	const [removeCircleAvatar, { isLoading: isRemovingAvatar }] = useRemoveCircleAvatarMutation();

	const getInitials = (n: string | null) => {
		if (!n) return '?';
		return n
			.split(' ')
			.map(p => p[0])
			.join('')
			.toUpperCase()
			.slice(0, 2);
	};

	const formatDate = (d: string) =>
		new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

	const hasGeneralChanges = circle ? name !== circle.name || description !== (circle.description || '') : false;

	const handleSaveGeneral = async () => {
		if (!circle || !name.trim()) {
			setGeneralError('Circle name is required');
			return;
		}
		if (name.trim().length > 100) {
			setGeneralError('Circle name must be less than 100 characters');
			return;
		}
		setGeneralError('');
		try {
			await updateCircle({
				id: circle.id,
				name: name.trim(),
				description: description.trim() || undefined,
			}).unwrap();
			toast({ title: 'Settings saved' });
		} catch (err) {
			setGeneralError((err as { data?: { error?: string } })?.data?.error || 'Failed to update circle');
		}
	};

	const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
		if (!circle) return;
		const file = e.target.files?.[0];
		if (!file) return;
		if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
			toast({
				title: 'Invalid file type',
				description: 'Please upload a JPEG, PNG, GIF, or WebP image.',
				variant: 'destructive',
			});
			return;
		}
		if (file.size > 5 * 1024 * 1024) {
			toast({
				title: 'File too large',
				description: 'Please upload an image smaller than 5MB.',
				variant: 'destructive',
			});
			return;
		}
		try {
			await uploadCircleAvatar({ circleId: circle.id, file }).unwrap();
			toast({ title: 'Avatar updated' });
		} catch (err) {
			toast({
				title: 'Upload failed',
				description: (err as { data?: { error?: string } })?.data?.error || 'Failed to upload avatar',
				variant: 'destructive',
			});
		} finally {
			if (fileInputRef.current) fileInputRef.current.value = '';
		}
	};

	const handleRemoveAvatar = async () => {
		if (!circle) return;
		try {
			await removeCircleAvatar(circle.id).unwrap();
			toast({ title: 'Avatar removed' });
		} catch (err) {
			toast({
				title: 'Failed to remove avatar',
				description: (err as { data?: { error?: string } })?.data?.error || 'Failed to remove avatar',
				variant: 'destructive',
			});
		}
	};

	const handleAddMember = async () => {
		if (!circle || !addEmail.trim() || !addEmail.includes('@')) {
			toast({
				title: 'Invalid email',
				description: 'Please enter a valid email address.',
				variant: 'destructive',
			});
			return;
		}
		try {
			const newMember = await addMember({ circleId: circle.id, email: addEmail.trim() }).unwrap();
			setAddEmail('');
			toast({ title: 'Member added', description: `${newMember.name || newMember.email} has been added.` });
		} catch (err) {
			toast({
				title: 'Failed to add member',
				description: (err as { data?: { error?: string } })?.data?.error || 'Failed to add member',
				variant: 'destructive',
			});
		}
	};

	const handleUpdateMemberRole = async (member: CircleMember, newRole: 'ADMIN' | 'MEMBER') => {
		if (!circle) return;
		setProcessingMemberId(member.userId);
		try {
			await updateMemberRole({ circleId: circle.id, userId: member.userId, role: newRole }).unwrap();
			toast({
				title: 'Role updated',
				description: `${member.name || 'Member'} is now ${newRole === 'ADMIN' ? 'an admin' : 'a member'}.`,
			});
		} catch (err) {
			toast({
				title: 'Failed to update role',
				description: (err as { data?: { error?: string } })?.data?.error || 'Failed to update role',
				variant: 'destructive',
			});
		} finally {
			setProcessingMemberId(null);
		}
	};

	const handleRemoveMember = async (member: CircleMember) => {
		if (!circle) return;
		setProcessingMemberId(member.userId);
		try {
			await removeMember({ circleId: circle.id, userId: member.userId }).unwrap();
			toast({ title: 'Member removed', description: `${member.name || 'Member'} has been removed.` });
		} catch (err) {
			toast({
				title: 'Failed to remove member',
				description: (err as { data?: { error?: string } })?.data?.error || 'Failed to remove member',
				variant: 'destructive',
			});
		} finally {
			setProcessingMemberId(null);
		}
	};

	const handleDeleteCircle = async () => {
		if (!circle || confirmDelete !== circle.name) {
			toast({
				title: 'Confirmation required',
				description: 'Please type the circle name exactly.',
				variant: 'destructive',
			});
			return;
		}
		try {
			await deleteCircle(circle.id).unwrap();
			toast({ title: 'Circle deleted' });
			router.push('/circles');
		} catch (err) {
			toast({
				title: 'Failed to delete circle',
				description: (err as { data?: { error?: string } })?.data?.error || 'Failed to delete circle',
				variant: 'destructive',
			});
		}
	};

	if (isLoading) return <CircleDetailSkeleton />;
	if (!circle) return null;

	const filteredMembers = (circle.members ?? []).filter(
		(m: CircleMember) =>
			m.name?.toLowerCase().includes(memberSearch.toLowerCase()) ||
			m.email?.toLowerCase().includes(memberSearch.toLowerCase()),
	);

	return (
		<PageShell className="space-y-5 sm:space-y-6">
			{/* Page Header */}
			<div className="flex items-center gap-3">
				<Button
					variant="ghost"
					size="icon"
					className="h-9 w-9 shrink-0"
					onClick={() => router.push(`/circles/${circleId}`)}
				>
					<ArrowLeft className="h-4 w-4" />
					<span className="sr-only">Back</span>
				</Button>
				<div className="min-w-0 flex-1">
					<h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Circle Settings</h1>
					<p className="text-xs text-muted-foreground sm:text-sm truncate">{circle.name}</p>
				</div>
			</div>

			<PageTabs defaultValue={initialTab}>
				<PageTabsList className="w-full sm:w-auto">
					<PageTabsTrigger value="general">General</PageTabsTrigger>
					<PageTabsTrigger value="members" badge={(circle.members ?? []).length}>
						Members
					</PageTabsTrigger>
					<PageTabsTrigger value="danger">Danger</PageTabsTrigger>
				</PageTabsList>

				{/* General Tab */}
				<PageTabsContent value="general" className="space-y-6">
					{/* Avatar */}
					<div className="space-y-3">
						<Label>Circle Avatar</Label>
						<div className="flex items-center gap-4">
							<div className="relative">
								<div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-border/50 overflow-hidden flex items-center justify-center">
									{circle.avatarUrl ? (
										<img
											src={circle.avatarUrl}
											alt={circle.name}
											className="h-full w-full object-cover"
										/>
									) : (
										<Users className="h-8 w-8 text-primary" />
									)}
								</div>
								{(isUploadingAvatar || isRemovingAvatar) && (
									<div className="absolute inset-0 bg-background/80 rounded-2xl flex items-center justify-center">
										<Loader2 className="h-5 w-5 animate-spin" />
									</div>
								)}
							</div>
							<div className="space-y-2">
								<input
									ref={fileInputRef}
									type="file"
									accept="image/jpeg,image/png,image/gif,image/webp"
									className="hidden"
									onChange={handleAvatarUpload}
									disabled={isUploadingAvatar}
								/>
								<Button
									variant="outline"
									size="sm"
									className="gap-2"
									onClick={() => fileInputRef.current?.click()}
									disabled={isUploadingAvatar}
								>
									<Upload className="h-4 w-4" />
									Upload
								</Button>
								{circle.avatarUrl && (
									<Button
										variant="ghost"
										size="sm"
										className="gap-2 text-destructive hover:text-destructive"
										onClick={handleRemoveAvatar}
										disabled={isRemovingAvatar}
									>
										<Trash2 className="h-4 w-4" />
										Remove
									</Button>
								)}
							</div>
						</div>
						<p className="text-xs text-muted-foreground">
							Recommended: square image, at least 200×200px. Max 5MB.
						</p>
					</div>

					<Separator />

					{/* Name & Description */}
					<div className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="circle-name">
								Circle Name <span className="text-destructive">*</span>
							</Label>
							<Input
								id="circle-name"
								value={name}
								onChange={e => {
									setName(e.target.value);
									setGeneralError('');
								}}
								placeholder="Enter circle name"
								maxLength={100}
								disabled={isSaving}
							/>
							<p className="text-xs text-muted-foreground">{name.length}/100 characters</p>
						</div>

						<div className="space-y-2">
							<Label htmlFor="circle-description">Description</Label>
							<Textarea
								id="circle-description"
								value={description}
								onChange={e => setDescription(e.target.value)}
								placeholder="What's this circle about?"
								rows={3}
								className="resize-none"
								disabled={isSaving}
							/>
						</div>
					</div>

					{generalError && (
						<Alert variant="destructive">
							<AlertDescription>{generalError}</AlertDescription>
						</Alert>
					)}

					<div className="flex justify-end">
						<Button onClick={handleSaveGeneral} disabled={isSaving || !hasGeneralChanges || !name.trim()}>
							{isSaving ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Saving…
								</>
							) : (
								'Save Changes'
							)}
						</Button>
					</div>
				</PageTabsContent>

				{/* Members Tab */}
				<PageTabsContent value="members" className="space-y-4">
					{/* Add Member */}
					<div className="space-y-2">
						<Label>Add Member by Email</Label>
						<div className="flex gap-2">
							<Input
								placeholder="Enter email address"
								value={addEmail}
								onChange={e => setAddEmail(e.target.value)}
								onKeyDown={e => e.key === 'Enter' && handleAddMember()}
								disabled={isAddingMember}
								type="email"
							/>
							<Button onClick={handleAddMember} disabled={isAddingMember || !addEmail.trim()}>
								{isAddingMember ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									<UserPlus className="h-4 w-4" />
								)}
							</Button>
						</div>
						<p className="text-xs text-muted-foreground">User must have an existing ShareCircle account.</p>
					</div>

					<Separator />

					{/* Search */}
					<div className="relative">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<Input
							placeholder="Search members…"
							value={memberSearch}
							onChange={e => setMemberSearch(e.target.value)}
							className="pl-9"
						/>
						{memberSearch && (
							<Button
								variant="ghost"
								size="sm"
								className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
								onClick={() => setMemberSearch('')}
							>
								<X className="h-4 w-4" />
							</Button>
						)}
					</div>

					{/* Members List */}
					<div className="space-y-2">
						{filteredMembers.length === 0 ? (
							<p className="text-sm text-muted-foreground text-center py-6">
								{memberSearch ? 'No members match your search' : 'No members found'}
							</p>
						) : (
							filteredMembers.map(member => {
								const isCreator = member.joinType === 'CREATED';
								const isProcessing = processingMemberId === member.userId;

								return (
									<div
										key={member.id}
										className="flex items-center gap-3 p-3 rounded-lg border border-border/70 bg-card"
									>
										<Avatar className="h-10 w-10 flex-shrink-0">
											<AvatarImage src={member.image || undefined} />
											<AvatarFallback className="text-sm">
												{getInitials(member.name)}
											</AvatarFallback>
										</Avatar>

										<div className="flex-1 min-w-0">
											<div className="flex items-center gap-2 flex-wrap">
												<p className="font-medium text-sm truncate">
													{member.name || member.email || 'Unknown'}
												</p>
												{member.role === 'ADMIN' && (
													<Badge
														variant="secondary"
														className="gap-1 text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
													>
														<Crown className="h-3 w-3" />
														Admin
													</Badge>
												)}
												{isCreator && (
													<Badge variant="outline" className="text-xs">
														Creator
													</Badge>
												)}
											</div>
											<p className="text-xs text-muted-foreground">
												Joined {formatDate(member.joinedAt)}
											</p>
										</div>

										{!isCreator && (
											<div className="flex items-center gap-1 shrink-0">
												{member.role === 'MEMBER' ? (
													<Button
														variant="ghost"
														size="sm"
														className="h-8 gap-1 text-xs"
														onClick={() => handleUpdateMemberRole(member, 'ADMIN')}
														disabled={isProcessing}
													>
														{isProcessing ? (
															<Loader2 className="h-3 w-3 animate-spin" />
														) : (
															<>
																<Crown className="h-3 w-3" />
																<span className="hidden sm:inline">Make Admin</span>
															</>
														)}
													</Button>
												) : (
													<Button
														variant="ghost"
														size="sm"
														className="h-8 gap-1 text-xs"
														onClick={() => handleUpdateMemberRole(member, 'MEMBER')}
														disabled={isProcessing}
													>
														{isProcessing ? (
															<Loader2 className="h-3 w-3 animate-spin" />
														) : (
															<>
																<Shield className="h-3 w-3" />
																<span className="hidden sm:inline">Remove Admin</span>
															</>
														)}
													</Button>
												)}
												<Button
													variant="ghost"
													size="sm"
													className="h-8 w-8 p-0 text-destructive hover:text-destructive"
													onClick={() => handleRemoveMember(member)}
													disabled={isProcessing}
												>
													{isProcessing ? (
														<Loader2 className="h-3 w-3 animate-spin" />
													) : (
														<UserMinus className="h-4 w-4" />
													)}
												</Button>
											</div>
										)}
									</div>
								);
							})
						)}
					</div>
				</PageTabsContent>

				{/* Danger Zone Tab */}
				<PageTabsContent value="danger" className="space-y-6">
					<Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
						<AlertTriangle className="h-4 w-4" />
						<AlertDescription>Actions here are permanent and cannot be undone.</AlertDescription>
					</Alert>

					<div className="space-y-4 rounded-lg border border-destructive/50 p-4">
						<div>
							<h3 className="font-semibold text-destructive">Delete Circle</h3>
							<p className="text-sm text-muted-foreground mt-1">
								Permanently delete this circle and all associated data.
							</p>
						</div>

						<div className="space-y-2">
							<Label htmlFor="confirm-delete" className="text-sm">
								Type <span className="font-mono font-bold">{circle.name}</span> to confirm:
							</Label>
							<Input
								id="confirm-delete"
								value={confirmDelete}
								onChange={e => setConfirmDelete(e.target.value)}
								placeholder={circle.name}
								disabled={isDeleting}
							/>
						</div>

						<Button
							variant="destructive"
							className="w-full gap-2"
							onClick={handleDeleteCircle}
							disabled={isDeleting || confirmDelete !== circle.name}
						>
							{isDeleting ? (
								<>
									<Loader2 className="h-4 w-4 animate-spin" />
									Deleting…
								</>
							) : (
								<>
									<Trash2 className="h-4 w-4" />
									Delete Circle Permanently
								</>
							)}
						</Button>
					</div>
				</PageTabsContent>
			</PageTabs>
		</PageShell>
	);
}
