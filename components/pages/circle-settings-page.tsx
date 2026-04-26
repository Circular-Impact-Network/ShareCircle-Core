'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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
import { useToast } from '@/hooks/use-toast';
import { CircleDetailSkeleton } from '@/components/ui/skeletons';

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
	avatarUrl: string | null;
	inviteCode: string;
	inviteExpiresAt: string;
	createdAt: string;
	updatedAt: string;
	createdBy: { id: string; name: string | null; image: string | null; email: string | null };
	membersCount: number;
	userRole: 'ADMIN' | 'MEMBER';
	members: Member[];
}

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

	const [circle, setCircle] = useState<Circle | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	// General tab
	const [name, setName] = useState('');
	const [description, setDescription] = useState('');
	const [isSaving, setIsSaving] = useState(false);
	const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
	const [isRemovingAvatar, setIsRemovingAvatar] = useState(false);
	const [generalError, setGeneralError] = useState('');

	// Members tab
	const [memberSearch, setMemberSearch] = useState('');
	const [addEmail, setAddEmail] = useState('');
	const [isAddingMember, setIsAddingMember] = useState(false);
	const [processingMemberId, setProcessingMemberId] = useState<string | null>(null);

	// Danger zone
	const [confirmDelete, setConfirmDelete] = useState('');
	const [isDeleting, setIsDeleting] = useState(false);

	const fetchCircle = useCallback(async () => {
		try {
			setIsLoading(true);
			const res = await fetch(`/api/circles/${circleId}`);
			if (!res.ok) {
				if (res.status === 403) {
					router.push('/circles');
					return;
				}
				throw new Error('Failed to fetch circle');
			}
			const data: Circle = await res.json();
			if (data.userRole !== 'ADMIN') {
				router.push(`/circles/${circleId}`);
				return;
			}
			setCircle(data);
			setName(data.name);
			setDescription(data.description || '');
		} catch {
			toast({ title: 'Failed to load circle', variant: 'destructive' });
			router.push('/circles');
		} finally {
			setIsLoading(false);
		}
	}, [circleId, router, toast]);

	useEffect(() => {
		fetchCircle();
	}, [fetchCircle]);

	const getInitials = (n: string | null) => {
		if (!n) return '?';
		return n.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2);
	};

	const formatDate = (d: string) =>
		new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

	const hasGeneralChanges = circle ? name !== circle.name || description !== (circle.description || '') : false;

	const handleSaveGeneral = async () => {
		if (!circle || !name.trim()) { setGeneralError('Circle name is required'); return; }
		if (name.trim().length > 100) { setGeneralError('Circle name must be less than 100 characters'); return; }
		setIsSaving(true);
		setGeneralError('');
		try {
			const res = await fetch(`/api/circles/${circle.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: name.trim(), description: description.trim() || null }),
			});
			if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to update circle'); }
			const updated = await res.json();
			setCircle(prev => prev ? { ...prev, name: updated.name, description: updated.description } : null);
			toast({ title: 'Settings saved' });
		} catch (err) {
			setGeneralError(err instanceof Error ? err.message : 'Failed to update circle');
		} finally {
			setIsSaving(false);
		}
	};

	const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
		if (!circle) return;
		const file = e.target.files?.[0];
		if (!file) return;
		if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
			toast({ title: 'Invalid file type', description: 'Please upload a JPEG, PNG, GIF, or WebP image.', variant: 'destructive' });
			return;
		}
		if (file.size > 5 * 1024 * 1024) {
			toast({ title: 'File too large', description: 'Please upload an image smaller than 5MB.', variant: 'destructive' });
			return;
		}
		setIsUploadingAvatar(true);
		try {
			const formData = new FormData();
			formData.append('file', file);
			const res = await fetch(`/api/circles/${circle.id}/avatar`, { method: 'POST', body: formData });
			if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to upload avatar'); }
			const data = await res.json();
			setCircle(prev => prev ? { ...prev, avatarUrl: data.avatarUrl } : null);
			toast({ title: 'Avatar updated' });
		} catch (err) {
			toast({ title: 'Upload failed', description: err instanceof Error ? err.message : 'Failed to upload avatar', variant: 'destructive' });
		} finally {
			setIsUploadingAvatar(false);
			if (fileInputRef.current) fileInputRef.current.value = '';
		}
	};

	const handleRemoveAvatar = async () => {
		if (!circle) return;
		setIsRemovingAvatar(true);
		try {
			const res = await fetch(`/api/circles/${circle.id}/avatar`, { method: 'DELETE' });
			if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to remove avatar'); }
			setCircle(prev => prev ? { ...prev, avatarUrl: null } : null);
			toast({ title: 'Avatar removed' });
		} catch (err) {
			toast({ title: 'Failed to remove avatar', description: err instanceof Error ? err.message : 'Failed to remove avatar', variant: 'destructive' });
		} finally {
			setIsRemovingAvatar(false);
		}
	};

	const handleAddMember = async () => {
		if (!circle || !addEmail.trim() || !addEmail.includes('@')) {
			toast({ title: 'Invalid email', description: 'Please enter a valid email address.', variant: 'destructive' });
			return;
		}
		setIsAddingMember(true);
		try {
			const res = await fetch(`/api/circles/${circle.id}/members`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: addEmail.trim() }),
			});
			if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to add member'); }
			const newMember: Member = await res.json();
			setCircle(prev => prev ? { ...prev, members: [...prev.members, newMember], membersCount: prev.membersCount + 1 } : null);
			setAddEmail('');
			toast({ title: 'Member added', description: `${newMember.name || newMember.email} has been added.` });
		} catch (err) {
			toast({ title: 'Failed to add member', description: err instanceof Error ? err.message : 'Failed to add member', variant: 'destructive' });
		} finally {
			setIsAddingMember(false);
		}
	};

	const handleUpdateMemberRole = async (member: Member, newRole: 'ADMIN' | 'MEMBER') => {
		if (!circle) return;
		setProcessingMemberId(member.userId);
		try {
			const res = await fetch(`/api/circles/${circle.id}/members/${member.userId}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ role: newRole }),
			});
			if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to update role'); }
			setCircle(prev => prev ? { ...prev, members: prev.members.map(m => m.userId === member.userId ? { ...m, role: newRole } : m) } : null);
			toast({ title: 'Role updated', description: `${member.name || 'Member'} is now ${newRole === 'ADMIN' ? 'an admin' : 'a member'}.` });
		} catch (err) {
			toast({ title: 'Failed to update role', description: err instanceof Error ? err.message : 'Failed to update role', variant: 'destructive' });
		} finally {
			setProcessingMemberId(null);
		}
	};

	const handleRemoveMember = async (member: Member) => {
		if (!circle) return;
		setProcessingMemberId(member.userId);
		try {
			const res = await fetch(`/api/circles/${circle.id}/members/${member.userId}`, { method: 'DELETE' });
			if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to remove member'); }
			setCircle(prev => prev ? { ...prev, members: prev.members.filter(m => m.userId !== member.userId), membersCount: prev.membersCount - 1 } : null);
			toast({ title: 'Member removed', description: `${member.name || 'Member'} has been removed.` });
		} catch (err) {
			toast({ title: 'Failed to remove member', description: err instanceof Error ? err.message : 'Failed to remove member', variant: 'destructive' });
		} finally {
			setProcessingMemberId(null);
		}
	};

	const handleDeleteCircle = async () => {
		if (!circle || confirmDelete !== circle.name) {
			toast({ title: 'Confirmation required', description: 'Please type the circle name exactly.', variant: 'destructive' });
			return;
		}
		setIsDeleting(true);
		try {
			const res = await fetch(`/api/circles/${circle.id}`, { method: 'DELETE' });
			if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to delete circle'); }
			toast({ title: 'Circle deleted' });
			router.push('/circles');
		} catch (err) {
			toast({ title: 'Failed to delete circle', description: err instanceof Error ? err.message : 'Failed to delete circle', variant: 'destructive' });
		} finally {
			setIsDeleting(false);
		}
	};

	if (isLoading) return <CircleDetailSkeleton />;
	if (!circle) return null;

	const filteredMembers = circle.members.filter(
		m =>
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
					<PageTabsTrigger value="members" badge={circle.members.length}>Members</PageTabsTrigger>
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
										<img src={circle.avatarUrl} alt={circle.name} className="h-full w-full object-cover" />
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
						<p className="text-xs text-muted-foreground">Recommended: square image, at least 200×200px. Max 5MB.</p>
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
								onChange={e => { setName(e.target.value); setGeneralError(''); }}
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
								placeholder="What&apos;s this circle about?"
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
								<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</>
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
								{isAddingMember ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
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
									<div key={member.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/70 bg-card">
										<Avatar className="h-10 w-10 flex-shrink-0">
											<AvatarImage src={member.image || undefined} />
											<AvatarFallback className="text-sm">{getInitials(member.name)}</AvatarFallback>
										</Avatar>

										<div className="flex-1 min-w-0">
											<div className="flex items-center gap-2 flex-wrap">
												<p className="font-medium text-sm truncate">{member.name || member.email || 'Unknown'}</p>
												{member.role === 'ADMIN' && (
													<Badge variant="secondary" className="gap-1 text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
														<Crown className="h-3 w-3" />Admin
													</Badge>
												)}
												{isCreator && <Badge variant="outline" className="text-xs">Creator</Badge>}
											</div>
											<p className="text-xs text-muted-foreground">Joined {formatDate(member.joinedAt)}</p>
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
														{isProcessing ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Crown className="h-3 w-3" /><span className="hidden sm:inline">Make Admin</span></>}
													</Button>
												) : (
													<Button
														variant="ghost"
														size="sm"
														className="h-8 gap-1 text-xs"
														onClick={() => handleUpdateMemberRole(member, 'MEMBER')}
														disabled={isProcessing}
													>
														{isProcessing ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Shield className="h-3 w-3" /><span className="hidden sm:inline">Remove Admin</span></>}
													</Button>
												)}
												<Button
													variant="ghost"
													size="sm"
													className="h-8 w-8 p-0 text-destructive hover:text-destructive"
													onClick={() => handleRemoveMember(member)}
													disabled={isProcessing}
												>
													{isProcessing ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserMinus className="h-4 w-4" />}
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
								<><Loader2 className="h-4 w-4 animate-spin" />Deleting…</>
							) : (
								<><Trash2 className="h-4 w-4" />Delete Circle Permanently</>
							)}
						</Button>
					</div>
				</PageTabsContent>
			</PageTabs>
		</PageShell>
	);
}
