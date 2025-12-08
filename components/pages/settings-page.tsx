'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Bell, Moon, User, Shield, Smartphone, Mail, Globe, Camera, Loader2, Upload } from 'lucide-react';
import { useTheme } from '@/app/providers';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useAppSelector } from '@/lib/redux/hooks';
import {
	selectUserImage,
	selectUserName,
	selectUserEmail,
	selectUserPhoneNumber,
	selectUserCountryCode,
	selectUserBio,
} from '@/lib/redux/selectors/userSelectors';
import { useUpdateUserMutation, useUploadImageMutation } from '@/lib/redux/api/userApi';

export function SettingsPage() {
	const { theme, toggleTheme } = useTheme();
	const [activeTab, setActiveTab] = useState('profile');
	const fileInputRef = useRef<HTMLInputElement>(null);

	// Redux selectors
	const userImage = useAppSelector(selectUserImage);
	const userName = useAppSelector(selectUserName);
	const userEmail = useAppSelector(selectUserEmail);
	const userPhone = useAppSelector(selectUserPhoneNumber);
	const userCountryCode = useAppSelector(selectUserCountryCode);
	const userBio = useAppSelector(selectUserBio);

	// RTK Query mutations
	const [updateUser, { isLoading }] = useUpdateUserMutation();
	const [uploadImage, { isLoading: isUploadingImage }] = useUploadImageMutation();

	// Form states - initialize from Redux
	const [name, setName] = useState('');
	const [bio, setBio] = useState('');
	const [email, setEmail] = useState('');
	const [phone, setPhone] = useState('');
	const [countryCode, setCountryCode] = useState('+91');
	const [profileImage, setProfileImage] = useState('');

	// Sync form state with Redux when data loads
	useEffect(() => {
		if (userName !== null) setName(userName);
		if (userBio !== null) setBio(userBio);
		if (userEmail !== null) setEmail(userEmail);
		if (userPhone !== null) setPhone(userPhone);
		if (userCountryCode !== null) setCountryCode(userCountryCode);
		if (userImage !== null) setProfileImage(userImage);
	}, [userName, userBio, userEmail, userPhone, userCountryCode, userImage]);

	const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		// Validate file type
		if (!file.type.startsWith('image/')) {
			toast.error('Please select an image file');
			return;
		}

		// Validate file size (5MB)
		if (file.size > 5 * 1024 * 1024) {
			toast.error('Image must be smaller than 5MB');
			return;
		}

		try {
			// Upload image using RTK Query mutation
			const uploadResult = await uploadImage(file).unwrap();

			// Update user profile with new image URL
			await updateUser({ image: uploadResult.url }).unwrap();

			// Update local state (will be synced from Redux via useEffect)
			setProfileImage(uploadResult.url);

			toast.success('Profile image updated successfully');
		} catch (error) {
			console.error('Image upload error:', error);
			toast.error('Failed to upload image');
		}
	};

	const handleSaveProfile = async (e: React.FormEvent) => {
		e.preventDefault();

		try {
			await updateUser({ name, bio }).unwrap();
			toast.success('Profile updated successfully');
		} catch (error) {
			console.error('Profile update error:', error);
			toast.error('Failed to update profile');
		}
	};

	const handleUpdateContactInfo = async () => {
		try {
			await updateUser({ phoneNumber: phone, countryCode }).unwrap();
			toast.success('Contact information updated successfully');
		} catch (error) {
			console.error('Contact info update error:', error);
			toast.error('Failed to update contact information');
		}
	};

	const getInitials = (name: string) => {
		if (!name) return 'U';
		return name
			.split(' ')
			.map(n => n[0])
			.join('')
			.toUpperCase()
			.slice(0, 2);
	};

	return (
		<div className="container max-w-4xl mx-auto p-4 md:p-8 space-y-8">
			<div>
				<h1 className="text-3xl font-bold tracking-tight">Settings</h1>
				<p className="text-muted-foreground mt-2">Manage your account settings and preferences.</p>
			</div>

			<Tabs defaultValue="profile" value={activeTab} onValueChange={setActiveTab} className="space-y-6">
				<TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
					<TabsTrigger value="profile">Profile</TabsTrigger>
					<TabsTrigger value="account">Account</TabsTrigger>
					<TabsTrigger value="appearance">Appearance</TabsTrigger>
				</TabsList>

				<TabsContent value="profile" className="space-y-6">
					<Card>
						<CardHeader>
							<CardTitle>Public Profile</CardTitle>
							<CardDescription>This is how others will see you on the site.</CardDescription>
						</CardHeader>
						<CardContent className="space-y-6">
							<div className="flex flex-col md:flex-row gap-6 items-start">
								<div className="flex flex-col items-center gap-4">
									<Avatar className="w-24 h-24 md:w-32 md:h-32 border-4 border-background shadow-xl">
										<AvatarImage src={profileImage} />
										<AvatarFallback className="text-2xl md:text-4xl bg-primary text-primary-foreground">
											{getInitials(name)}
										</AvatarFallback>
									</Avatar>
									<input
										ref={fileInputRef}
										type="file"
										accept="image/*"
										className="hidden"
										onChange={handleImageUpload}
									/>
									<Button
										variant="outline"
										size="sm"
										className="gap-2"
										disabled={isUploadingImage}
										onClick={() => fileInputRef.current?.click()}
									>
										{isUploadingImage ? (
											<>
												<Loader2 className="w-4 h-4 animate-spin" /> Uploading...
											</>
										) : (
											<>
												<Camera className="w-4 h-4" /> Change Photo
											</>
										)}
									</Button>
								</div>

								<form onSubmit={handleSaveProfile} className="flex-1 space-y-4 w-full">
									<div className="space-y-2">
										<Label htmlFor="name">Display Name</Label>
										<Input
											id="name"
											value={name}
											onChange={e => setName(e.target.value)}
											placeholder="Your name"
										/>
									</div>

									<div className="space-y-2">
										<Label htmlFor="bio">Bio</Label>
										<Textarea
											id="bio"
											value={bio}
											onChange={e => setBio(e.target.value)}
											placeholder="Tell us a little bit about yourself"
											className="min-h-[100px]"
										/>
									</div>

									<div className="flex justify-end pt-4">
										<Button type="submit" disabled={isLoading}>
											{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
											Save Changes
										</Button>
									</div>
								</form>
							</div>
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="account" className="space-y-6">
					<Card>
						<CardHeader>
							<CardTitle>Contact Information</CardTitle>
							<CardDescription>
								Manage your contact details and communication preferences.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-6">
							<div className="space-y-4">
								<div className="space-y-2">
									<Label htmlFor="email">Email Address</Label>
									<div className="relative">
										<Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
										<Input id="email" value={email} disabled className="pl-9 bg-muted" />
									</div>
									<p className="text-xs text-muted-foreground">
										Email address cannot be changed directly. Contact support for assistance.
									</p>
								</div>

								<div className="space-y-2">
									<Label htmlFor="phone">Phone Number</Label>
									<div className="flex gap-2">
										<Select value={countryCode} onValueChange={setCountryCode}>
											<SelectTrigger className="w-[100px]">
												<SelectValue placeholder="Code" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="+1">🇺🇸 +1</SelectItem>
												<SelectItem value="+44">🇬🇧 +44</SelectItem>
												<SelectItem value="+91">🇮🇳 +91</SelectItem>
												<SelectItem value="+61">🇦🇺 +61</SelectItem>
												<SelectItem value="+81">🇯🇵 +81</SelectItem>
												<SelectItem value="+49">🇩🇪 +49</SelectItem>
											</SelectContent>
										</Select>
										<div className="relative flex-1">
											<Smartphone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
											<Input
												id="phone"
												value={phone}
												onChange={e => setPhone(e.target.value)}
												placeholder="1234567890"
												className="pl-9"
											/>
										</div>
									</div>
								</div>
							</div>

							<div className="flex justify-end pt-4">
								<Button onClick={handleUpdateContactInfo} disabled={isLoading}>
									{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
									Update Contact Info
								</Button>
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Security</CardTitle>
							<CardDescription>Manage your password and security settings.</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="flex items-center justify-between p-4 border rounded-lg">
								<div className="space-y-0.5">
									<div className="font-medium">Password</div>
									<div className="text-sm text-muted-foreground">Last changed 3 months ago</div>
								</div>
								<Button variant="outline">Change Password</Button>
							</div>
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="appearance" className="space-y-6">
					<Card>
						<CardHeader>
							<CardTitle>Appearance</CardTitle>
							<CardDescription>Customize how ShareCircle looks on your device.</CardDescription>
						</CardHeader>
						<CardContent className="space-y-6">
							<div className="flex items-center justify-between">
								<div className="space-y-0.5">
									<div className="font-medium flex items-center gap-2">
										<Moon className="w-4 h-4" />
										Dark Mode
									</div>
									<div className="text-sm text-muted-foreground">
										Switch between light and dark themes
									</div>
								</div>
								<Switch checked={theme === 'dark'} onCheckedChange={toggleTheme} />
							</div>

							<div className="flex items-center justify-between">
								<div className="space-y-0.5">
									<div className="font-medium flex items-center gap-2">
										<Bell className="w-4 h-4" />
										Notifications
									</div>
									<div className="text-sm text-muted-foreground">
										Receive updates about your circles and items
									</div>
								</div>
								<Switch defaultChecked />
							</div>
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	);
}
