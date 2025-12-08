'use client';

import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
	Loader2,
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
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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

interface CircleSettingsDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	circle: Circle;
	currentUserId: string | undefined;
	onCircleUpdated: (updates: Partial<Circle>) => void;
	onCircleDeleted: () => void;
	onMemberUpdated: (member: Member) => void;
	onMemberRemoved: (userId: string) => void;
	onMemberAdded: (member: Member) => void;
}

export function CircleSettingsDialog({
	open,
	onOpenChange,
	circle,
	currentUserId,
	onCircleUpdated,
	onCircleDeleted,
	onMemberUpdated,
	onMemberRemoved,
	onMemberAdded,
}: CircleSettingsDialogProps) {
	const { toast } = useToast();
	const fileInputRef = useRef<HTMLInputElement>(null);

	// General tab state
	const [name, setName] = useState(circle.name);
	const [description, setDescription] = useState(circle.description || '');
	const [isSaving, setIsSaving] = useState(false);
	const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
	const [isRemovingAvatar, setIsRemovingAvatar] = useState(false);

	// Members tab state
	const [memberSearch, setMemberSearch] = useState('');
	const [addEmail, setAddEmail] = useState('');
	const [isAddingMember, setIsAddingMember] = useState(false);
	const [processingMemberId, setProcessingMemberId] = useState<string | null>(null);

	// Danger zone state
	const [confirmDelete, setConfirmDelete] = useState('');
	const [isDeleting, setIsDeleting] = useState(false);

	const [error, setError] = useState('');

	// Reset state when dialog opens
	useEffect(() => {
		if (open) {
			setName(circle.name);
			setDescription(circle.description || '');
			setError('');
			setConfirmDelete('');
			setMemberSearch('');
			setAddEmail('');
		}
	}, [open, circle]);

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

	const hasGeneralChanges = name !== circle.name || description !== (circle.description || '');

	const handleSaveGeneral = async () => {
		if (!name.trim()) {
			setError('Circle name is required');
			return;
		}

		if (name.trim().length > 100) {
			setError('Circle name must be less than 100 characters');
			return;
		}

		setIsSaving(true);
		setError('');

		try {
			const response = await fetch(`/api/circles/${circle.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: name.trim(),
					description: description.trim() || null,
				}),
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.error || 'Failed to update circle');
			}

			const updated = await response.json();
			onCircleUpdated({
				name: updated.name,
				description: updated.description,
			});

			toast({
				title: 'Settings saved',
				description: 'Circle settings have been updated.',
			});
		} catch (err) {
			console.error('Error updating circle:', err);
			setError(err instanceof Error ? err.message : 'Failed to update circle');
		} finally {
			setIsSaving(false);
		}
	};

	const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		// Validate file type
		const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
		if (!validTypes.includes(file.type)) {
			toast({
				title: 'Invalid file type',
				description: 'Please upload a JPEG, PNG, GIF, or WebP image.',
				variant: 'destructive',
			});
			return;
		}

		// Validate file size (5MB)
		if (file.size > 5 * 1024 * 1024) {
			toast({
				title: 'File too large',
				description: 'Please upload an image smaller than 5MB.',
				variant: 'destructive',
			});
			return;
		}

		setIsUploadingAvatar(true);

		try {
			const formData = new FormData();
			formData.append('file', file);

			const response = await fetch(`/api/circles/${circle.id}/avatar`, {
				method: 'POST',
				body: formData,
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.error || 'Failed to upload avatar');
			}

			const data = await response.json();
			onCircleUpdated({
				avatarUrl: data.avatarUrl,
			});

			toast({
				title: 'Avatar updated',
				description: 'Circle avatar has been updated.',
			});
		} catch (err) {
			console.error('Error uploading avatar:', err);
			toast({
				title: 'Upload failed',
				description: err instanceof Error ? err.message : 'Failed to upload avatar',
				variant: 'destructive',
			});
		} finally {
			setIsUploadingAvatar(false);
			if (fileInputRef.current) {
				fileInputRef.current.value = '';
			}
		}
	};

	const handleRemoveAvatar = async () => {
		setIsRemovingAvatar(true);

		try {
			const response = await fetch(`/api/circles/${circle.id}/avatar`, {
				method: 'DELETE',
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.error || 'Failed to remove avatar');
			}

			onCircleUpdated({
				avatarUrl: null,
			});

			toast({
				title: 'Avatar removed',
				description: 'Circle avatar has been removed.',
			});
		} catch (err) {
			console.error('Error removing avatar:', err);
			toast({
				title: 'Failed to remove avatar',
				description: err instanceof Error ? err.message : 'Failed to remove avatar',
				variant: 'destructive',
			});
		} finally {
			setIsRemovingAvatar(false);
		}
	};

	const handleAddMember = async () => {
		if (!addEmail.trim() || !addEmail.includes('@')) {
			toast({
				title: 'Invalid email',
				description: 'Please enter a valid email address.',
				variant: 'destructive',
			});
			return;
		}

		setIsAddingMember(true);

		try {
			const response = await fetch(`/api/circles/${circle.id}/members`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: addEmail.trim() }),
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.error || 'Failed to add member');
			}

			const newMember = await response.json();
			onMemberAdded(newMember);
			setAddEmail('');

			toast({
				title: 'Member added',
				description: `${newMember.name || newMember.email} has been added to the circle.`,
			});
		} catch (err) {
			console.error('Error adding member:', err);
			toast({
				title: 'Failed to add member',
				description: err instanceof Error ? err.message : 'Failed to add member',
				variant: 'destructive',
			});
		} finally {
			setIsAddingMember(false);
		}
	};

	const handleUpdateMemberRole = async (member: Member, newRole: 'ADMIN' | 'MEMBER') => {
		setProcessingMemberId(member.userId);

		try {
			const response = await fetch(`/api/circles/${circle.id}/members/${member.userId}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ role: newRole }),
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.error || 'Failed to update role');
			}

			onMemberUpdated({ ...member, role: newRole });

			toast({
				title: 'Role updated',
				description: `${member.name || 'Member'} is now ${newRole === 'ADMIN' ? 'an admin' : 'a member'}.`,
			});
		} catch (err) {
			console.error('Error updating member role:', err);
			toast({
				title: 'Failed to update role',
				description: err instanceof Error ? err.message : 'Failed to update role',
				variant: 'destructive',
			});
		} finally {
			setProcessingMemberId(null);
		}
	};

	const handleRemoveMember = async (member: Member) => {
		setProcessingMemberId(member.userId);

		try {
			const response = await fetch(`/api/circles/${circle.id}/members/${member.userId}`, {
				method: 'DELETE',
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.error || 'Failed to remove member');
			}

			onMemberRemoved(member.userId);

			toast({
				title: 'Member removed',
				description: `${member.name || 'Member'} has been removed from the circle.`,
			});
		} catch (err) {
			console.error('Error removing member:', err);
			toast({
				title: 'Failed to remove member',
				description: err instanceof Error ? err.message : 'Failed to remove member',
				variant: 'destructive',
			});
		} finally {
			setProcessingMemberId(null);
		}
	};

	const handleDeleteCircle = async () => {
		if (confirmDelete !== circle.name) {
			toast({
				title: 'Confirmation required',
				description: 'Please type the circle name exactly to confirm deletion.',
				variant: 'destructive',
			});
			return;
		}

		setIsDeleting(true);

		try {
			const response = await fetch(`/api/circles/${circle.id}`, {
				method: 'DELETE',
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.error || 'Failed to delete circle');
			}

			toast({
				title: 'Circle deleted',
				description: 'The circle has been permanently deleted.',
			});

			onCircleDeleted();
		} catch (err) {
			console.error('Error deleting circle:', err);
			toast({
				title: 'Failed to delete circle',
				description: err instanceof Error ? err.message : 'Failed to delete circle',
				variant: 'destructive',
			});
		} finally {
			setIsDeleting(false);
		}
	};

	const filteredMembers = circle.members.filter(
		m =>
			m.name?.toLowerCase().includes(memberSearch.toLowerCase()) ||
			m.email?.toLowerCase().includes(memberSearch.toLowerCase()),
	);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl h-[50vh] min-h-[50vh] max-h-[50vh] overflow-hidden flex flex-col justify-between">
				<DialogHeader>
					<DialogTitle>Circle Settings</DialogTitle>
					<DialogDescription>Manage your circle&apos;s settings, members, and more.</DialogDescription>
				</DialogHeader>

				<Tabs defaultValue="general" className="flex-1 min-h-0 overflow-hidden flex flex-col">
					<TabsList className="grid w-full grid-cols-3">
						<TabsTrigger value="general">General</TabsTrigger>
						<TabsTrigger value="members">Members</TabsTrigger>
						<TabsTrigger value="danger">Account</TabsTrigger>
					</TabsList>

					{/* General Tab */}
					<TabsContent value="general" className="flex-1 min-h-0 overflow-auto space-y-6 p-1">
						{/* Avatar Section */}
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
								Recommended: Square image, at least 200x200px. Max 5MB.
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
										setError('');
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

						{error && (
							<Alert variant="destructive">
								<AlertDescription>{error}</AlertDescription>
							</Alert>
						)}

						<div className="flex justify-end">
							<Button
								onClick={handleSaveGeneral}
								disabled={isSaving || !hasGeneralChanges || !name.trim()}
							>
								{isSaving ? (
									<>
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										Saving...
									</>
								) : (
									'Save Changes'
								)}
							</Button>
						</div>
					</TabsContent>

					{/* Members Tab */}
					<TabsContent value="members" className="flex-1 min-h-0 overflow-hidden flex flex-col space-y-4 p-1">
						{/* Add Member Section */}
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
							<p className="text-xs text-muted-foreground">
								User must have an existing account to be added.
							</p>
						</div>

						<Separator />

						{/* Search Members */}
						<div className="relative">
							<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
							<Input
								placeholder="Search members..."
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
						<div className="flex-1 overflow-auto space-y-2 min-h-0">
							{filteredMembers.length === 0 ? (
								<p className="text-sm text-muted-foreground text-center py-4">
									{memberSearch ? 'No members match your search' : 'No members found'}
								</p>
							) : (
								filteredMembers.map(member => {
									const isCurrentUser = member.userId === currentUserId;
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
												<div className="flex items-center gap-2">
													<p className="font-medium text-sm truncate">
														{isCurrentUser
															? 'You'
															: member.name || member.email || 'Unknown'}
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
												<p className="text-xs text-muted-foreground truncate">
													Joined on {formatDate(member.joinedAt)}
												</p>
											</div>

											{/* Actions - don't show for current user or creator */}
											{!isCurrentUser && !isCreator && (
												<div className="flex items-center gap-1">
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
																	<span className="hidden sm:inline">
																		Remove Admin
																	</span>
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
					</TabsContent>

					{/* Danger Zone Tab */}
					<TabsContent value="danger" className="flex-1 min-h-0 overflow-auto space-y-6 p-1">
						<Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
							<AlertTriangle className="h-4 w-4" />
							<AlertDescription>
								Actions in this section are permanent and cannot be undone.
							</AlertDescription>
						</Alert>

						<div className="space-y-4 rounded-lg border border-destructive/50 p-4">
							<div>
								<h3 className="font-semibold text-destructive">Delete Circle</h3>
								<p className="text-sm text-muted-foreground mt-1">
									Permanently delete this circle and all associated data. This action cannot be
									reversed.
								</p>
							</div>

							<div className="space-y-2">
								<Label htmlFor="confirm-delete" className="text-sm">
									To confirm, type <span className="font-mono font-bold">{circle.name}</span> below:
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
										Deleting...
									</>
								) : (
									<>
										<Trash2 className="h-4 w-4" />
										Delete Circle Permanently
									</>
								)}
							</Button>
						</div>
					</TabsContent>
				</Tabs>
			</DialogContent>
		</Dialog>
	);
}
