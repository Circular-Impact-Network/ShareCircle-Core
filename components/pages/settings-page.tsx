'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Moon, Smartphone, Mail, Camera, Loader2, ShieldCheck } from 'lucide-react';
import { useTheme } from '@/app/providers';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useAppSelector } from '@/lib/redux/hooks';
import {
	PHONE_COUNTRIES,
	SupportedPhoneCountry,
	getDialCodeForCountry,
	isSupportedPhoneCountry,
	validatePhoneByCountry,
} from '@/lib/phone';
import {
	selectUserImage,
	selectUserName,
	selectUserEmail,
	selectUserPhoneNumber,
	selectUserCountryCode,
	selectUserBio,
} from '@/lib/redux/selectors/userSelectors';
import { useUpdateUserMutation, useUploadImageMutation } from '@/lib/redux/api/userApi';
import { PageHeader, PageShell } from '@/components/ui/page';
import { PageTabs, PageTabsContent, PageTabsList, PageTabsTrigger } from '@/components/ui/app-tabs';
import { NotificationPreferencesPanel } from '@/components/settings/notification-preferences-panel';

function getCountryFromDialCode(dialCode: string | null | undefined): SupportedPhoneCountry {
	const match = PHONE_COUNTRIES.find(country => getDialCodeForCountry(country.iso2) === dialCode);
	return match?.iso2 || 'IN';
}

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
	const [phoneCountry, setPhoneCountry] = useState<SupportedPhoneCountry>('IN');
	const [profileImage, setProfileImage] = useState('');
	const [contactStep, setContactStep] = useState<'idle' | 'verify'>('idle');
	const [contactError, setContactError] = useState('');
	const [contactSuccess, setContactSuccess] = useState('');
	const [contactIsLoading, setContactIsLoading] = useState(false);
	const [contactCooldown, setContactCooldown] = useState(0);
	const [contactOtp, setContactOtp] = useState(['', '', '', '', '', '']);
	const contactOtpRefs = useRef<(HTMLInputElement | null)[]>([]);
	const [passwordStep, setPasswordStep] = useState<'idle' | 'request' | 'verify' | 'reset' | 'success'>('idle');
	const [passwordError, setPasswordError] = useState('');
	const [passwordSuccess, setPasswordSuccess] = useState('');
	const [passwordIsLoading, setPasswordIsLoading] = useState(false);
	const [resendCooldown, setResendCooldown] = useState(0);
	const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
	const [resetToken, setResetToken] = useState('');
	const [newPassword, setNewPassword] = useState('');
	const [confirmNewPassword, setConfirmNewPassword] = useState('');
	const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

	// Initialize form state from Redux - use refs to track initialization
	const initializedRef = useRef(false);
	useEffect(() => {
		if (!initializedRef.current) {
			if (userName !== null) setName(userName);
			if (userBio !== null) setBio(userBio);
			if (userEmail !== null) setEmail(userEmail);
			if (userPhone !== null) setPhone(userPhone);
			if (userCountryCode !== null) setPhoneCountry(getCountryFromDialCode(userCountryCode));
			if (userImage !== null) setProfileImage(userImage);
			initializedRef.current = true;
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useEffect(() => {
		if (resendCooldown > 0) {
			const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
			return () => clearTimeout(timer);
		}
	}, [resendCooldown]);

	useEffect(() => {
		if (contactCooldown > 0) {
			const timer = setTimeout(() => setContactCooldown(contactCooldown - 1), 1000);
			return () => clearTimeout(timer);
		}
	}, [contactCooldown]);

	useEffect(() => {
		if (passwordStep === 'verify') {
			otpInputRefs.current[0]?.focus();
		}
	}, [passwordStep]);

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
		setContactError('');
		setContactSuccess('');

		const validation = validatePhoneByCountry(phone, phoneCountry);
		if (!validation.valid) {
			setContactError(validation.error || 'Please enter a valid phone number.');
			return;
		}

		setContactIsLoading(true);
		try {
			const response = await fetch('/api/auth/send-phone-otp', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					country: phoneCountry,
					phoneNumber: phone,
					purpose: 'phone_update',
				}),
			});
			const data = await response.json();
			if (!response.ok) {
				setContactError(data.error || 'Failed to send verification code.');
				setContactIsLoading(false);
				return;
			}

			setContactStep('verify');
			setContactCooldown(60);
			setContactOtp(['', '', '', '', '', '']);
			setContactSuccess('We sent a verification code to your phone.');
			contactOtpRefs.current[0]?.focus();
		} catch {
			setContactError('Failed to send verification code. Please try again.');
		} finally {
			setContactIsLoading(false);
		}
	};

	const handleContactOtpInputChange = (index: number, value: string) => {
		if (!/^\d*$/.test(value)) return;
		const next = [...contactOtp];
		next[index] = value.slice(-1);
		setContactOtp(next);
		setContactError('');
		if (value && index < 5) {
			contactOtpRefs.current[index + 1]?.focus();
		}
	};

	const handleContactOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === 'Backspace' && !contactOtp[index] && index > 0) {
			contactOtpRefs.current[index - 1]?.focus();
		}
	};

	const handleContactOtpPaste = (e: React.ClipboardEvent) => {
		e.preventDefault();
		const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
		if (pasted.length === 6) {
			setContactOtp(pasted.split(''));
		}
	};

	const handleVerifyContactOtp = async () => {
		const fullCode = contactOtp.join('');
		if (fullCode.length !== 6) {
			setContactError('Please enter the 6-digit code.');
			return;
		}

		setContactIsLoading(true);
		setContactError('');
		try {
			const response = await fetch('/api/auth/verify-phone-otp', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					country: phoneCountry,
					phoneNumber: phone,
					code: fullCode,
					purpose: 'phone_update',
				}),
			});
			const data = await response.json();
			if (!response.ok) {
				setContactError(data.error || 'Failed to verify code.');
				setContactIsLoading(false);
				return;
			}

			await updateUser({}).unwrap();
			setContactStep('idle');
			setContactOtp(['', '', '', '', '', '']);
			setContactSuccess('Phone number updated successfully.');
			toast.success('Phone number updated successfully');
		} catch (error) {
			console.error('Phone verification error:', error);
			setContactError('Failed to verify code. Please try again.');
		} finally {
			setContactIsLoading(false);
		}
	};

	const accountEmail = userEmail || email;

	const handleRequestPasswordOtp = async () => {
		setPasswordError('');
		setPasswordSuccess('');
		if (!accountEmail) {
			setPasswordError('Email is required to reset your password.');
			return;
		}

		setPasswordIsLoading(true);
		try {
			const response = await fetch('/api/auth/resend-otp', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: accountEmail, purpose: 'password_reset' }),
			});

			const data = await response.json();
			if (!response.ok) {
				setPasswordError(data.error || 'Failed to send verification code.');
				setPasswordIsLoading(false);
				return;
			}

			setPasswordStep('verify');
			setResendCooldown(60);
			setOtpCode(['', '', '', '', '', '']);
			setPasswordSuccess('We sent a verification code to your email.');
		} catch {
			setPasswordError('Failed to send verification code. Please try again.');
		} finally {
			setPasswordIsLoading(false);
		}
	};

	const handleOtpInputChange = (index: number, value: string) => {
		if (!/^\d*$/.test(value)) return;
		const next = [...otpCode];
		next[index] = value.slice(-1);
		setOtpCode(next);
		setPasswordError('');

		if (value && index < 5) {
			otpInputRefs.current[index + 1]?.focus();
		}
	};

	const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
			otpInputRefs.current[index - 1]?.focus();
		}
	};

	const handleOtpPaste = (e: React.ClipboardEvent) => {
		e.preventDefault();
		const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
		if (pasted.length === 6) {
			setOtpCode(pasted.split(''));
		}
	};

	const handleVerifyOtp = async () => {
		const fullCode = otpCode.join('');
		if (fullCode.length !== 6) {
			setPasswordError('Please enter the 6-digit code.');
			return;
		}
		if (!accountEmail) {
			setPasswordError('Email is required to reset your password.');
			return;
		}

		setPasswordIsLoading(true);
		try {
			const response = await fetch('/api/auth/verify-otp', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: accountEmail, code: fullCode, purpose: 'password_reset' }),
			});

			const data = await response.json();
			if (!response.ok) {
				setPasswordError(data.error || 'Failed to verify code.');
				setPasswordIsLoading(false);
				return;
			}

			setResetToken(data.resetToken || '');
			setPasswordStep('reset');
			setPasswordSuccess('Email verified. You can now set a new password.');
		} catch {
			setPasswordError('Failed to verify code. Please try again.');
		} finally {
			setPasswordIsLoading(false);
		}
	};

	const handleResetPassword = async (e: React.FormEvent) => {
		e.preventDefault();
		setPasswordError('');
		setPasswordSuccess('');

		if (!resetToken) {
			setPasswordError('Missing reset token. Please request a new code.');
			return;
		}

		if (!newPassword || !confirmNewPassword) {
			setPasswordError('Please fill in all fields.');
			return;
		}

		if (newPassword.length < 8) {
			setPasswordError('Password must be at least 8 characters.');
			return;
		}

		if (newPassword !== confirmNewPassword) {
			setPasswordError('Passwords do not match.');
			return;
		}

		setPasswordIsLoading(true);
		try {
			const response = await fetch('/api/auth/reset-password', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ token: resetToken, password: newPassword }),
			});
			const data = await response.json();
			if (!response.ok) {
				setPasswordError(data.error || 'Failed to reset password.');
				setPasswordIsLoading(false);
				return;
			}
			setPasswordStep('success');
			setPasswordSuccess('Password updated successfully.');
			setNewPassword('');
			setConfirmNewPassword('');
			setResetToken('');
		} catch {
			setPasswordError('Failed to reset password. Please try again.');
		} finally {
			setPasswordIsLoading(false);
		}
	};

	const renderPasswordFlow = () => {
		if (passwordStep === 'success') {
			return (
				<div className="rounded-lg border p-4 space-y-2">
					<div className="flex items-center gap-2 text-sm font-medium text-green-600">
						<ShieldCheck className="w-4 h-4" />
						Password updated successfully.
					</div>
					<Button
						variant="outline"
						onClick={() => {
							setPasswordStep('idle');
							setPasswordSuccess('');
							setPasswordError('');
						}}
					>
						Done
					</Button>
				</div>
			);
		}

		if (passwordStep === 'reset') {
			return (
				<form onSubmit={handleResetPassword} className="rounded-lg border p-4 space-y-4">
					<div>
						<Label className="text-sm">New Password</Label>
						<PasswordInput
							value={newPassword}
							onChange={e => setNewPassword(e.target.value)}
							className="mt-2"
							disabled={passwordIsLoading}
						/>
						<p className="text-xs text-muted-foreground mt-1">Must be at least 8 characters.</p>
					</div>
					<div>
						<Label className="text-sm">Confirm New Password</Label>
						<PasswordInput
							value={confirmNewPassword}
							onChange={e => setConfirmNewPassword(e.target.value)}
							className="mt-2"
							disabled={passwordIsLoading}
						/>
					</div>
					<Button type="submit" className="w-full sm:w-auto" disabled={passwordIsLoading}>
						{passwordIsLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
						Update Password
					</Button>
				</form>
			);
		}

		if (passwordStep === 'verify') {
			return (
				<div className="rounded-lg border p-4 space-y-4">
					<div className="text-sm text-muted-foreground">
						Enter the 6-digit code we sent to <span className="font-medium">{accountEmail}</span>.
					</div>
					<div className="flex gap-2 justify-center" onPaste={handleOtpPaste}>
						{otpCode.map((digit, index) => (
							<Input
								key={index}
								ref={el => {
									otpInputRefs.current[index] = el;
								}}
								type="text"
								inputMode="numeric"
								maxLength={1}
								value={digit}
								onChange={e => handleOtpInputChange(index, e.target.value)}
								onKeyDown={e => handleOtpKeyDown(index, e)}
								className="w-10 h-12 text-center text-lg font-semibold"
								disabled={passwordIsLoading}
							/>
						))}
					</div>
					<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
						<Button
							type="button"
							onClick={handleVerifyOtp}
							disabled={passwordIsLoading || otpCode.join('').length !== 6}
							className="w-full sm:w-auto"
						>
							{passwordIsLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
							Verify Code
						</Button>
						<Button
							type="button"
							variant="ghost"
							onClick={handleRequestPasswordOtp}
							disabled={resendCooldown > 0 || passwordIsLoading}
						>
							{resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
						</Button>
					</div>
				</div>
			);
		}

		if (passwordStep === 'request') {
			return (
				<div className="rounded-lg border p-4 space-y-4">
					<p className="text-sm text-muted-foreground">
						We will send a one-time code to <span className="font-medium">{accountEmail}</span> to confirm
						this change.
					</p>
					<Button
						onClick={handleRequestPasswordOtp}
						disabled={passwordIsLoading}
						className="w-full sm:w-auto"
					>
						{passwordIsLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
						Send Verification Code
					</Button>
				</div>
			);
		}

		return null;
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
		<PageShell className="max-w-5xl space-y-8">
			<PageHeader title="Settings" description="Manage your account settings and preferences." />

			<PageTabs defaultValue="profile" value={activeTab} onValueChange={setActiveTab}>
				<PageTabsList className="grid grid-cols-2 gap-1 sm:grid-cols-4 sm:gap-0">
					<PageTabsTrigger value="profile">Profile</PageTabsTrigger>
					<PageTabsTrigger value="account">Account</PageTabsTrigger>
					<PageTabsTrigger value="notifications">Notifications</PageTabsTrigger>
					<PageTabsTrigger value="appearance">Appearance</PageTabsTrigger>
				</PageTabsList>

				<PageTabsContent value="profile" className="space-y-6">
					<Card>
						<CardHeader>
							<CardTitle>Public Profile</CardTitle>
							<CardDescription>This is how others will see you on the site.</CardDescription>
						</CardHeader>
						<CardContent className="space-y-6">
							<div className="flex flex-col md:flex-row gap-6 items-start">
								<div className="flex flex-col items-center gap-4" data-testid="avatar-section">
									<Avatar className="w-24 h-24 md:w-32 md:h-32 border-4 border-background shadow-xl" data-testid="avatar">
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
				</PageTabsContent>

				<PageTabsContent value="account" className="space-y-6">
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
										<Select
											value={phoneCountry}
											onValueChange={value => {
												if (isSupportedPhoneCountry(value)) {
													setPhoneCountry(value);
												}
											}}
											disabled={contactIsLoading}
										>
											<SelectTrigger className="w-[130px]">
												<SelectValue placeholder="Code" />
											</SelectTrigger>
											<SelectContent>
												{PHONE_COUNTRIES.map(phoneCountryOption => (
													<SelectItem key={phoneCountryOption.iso2} value={phoneCountryOption.iso2}>
														{phoneCountryOption.flag} {getDialCodeForCountry(phoneCountryOption.iso2)}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										<div className="relative flex-1">
											<Smartphone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
											<Input
												id="phone"
												value={phone}
												onChange={e => setPhone(e.target.value)}
												placeholder="Phone number"
												className="pl-9"
												disabled={contactIsLoading}
											/>
										</div>
									</div>
									{contactError && (
										<p className="text-xs text-destructive">{contactError}</p>
									)}
									{contactSuccess && (
										<p className="text-xs text-green-600 dark:text-green-300">{contactSuccess}</p>
									)}
								</div>
							</div>

							<div className="flex justify-end pt-4">
								<Button onClick={handleUpdateContactInfo} disabled={contactIsLoading}>
									{contactIsLoading ? (
										<>
											<Loader2 className="mr-2 h-4 w-4 animate-spin" />
											Sending code...
										</>
									) : (
										'Update Contact Info'
									)}
								</Button>
							</div>

							{contactStep === 'verify' && (
								<div className="rounded-lg border p-4 space-y-4">
									<div className="text-sm text-muted-foreground">
										Enter the 6-digit code sent to {getDialCodeForCountry(phoneCountry)} {phone}.
									</div>
									<div className="flex gap-2 justify-center" onPaste={handleContactOtpPaste}>
										{contactOtp.map((digit, index) => (
											<Input
												key={index}
												ref={el => {
													contactOtpRefs.current[index] = el;
												}}
												type="text"
												inputMode="numeric"
												maxLength={1}
												value={digit}
												onChange={e => handleContactOtpInputChange(index, e.target.value)}
												onKeyDown={e => handleContactOtpKeyDown(index, e)}
												className="w-10 h-12 text-center text-lg font-semibold"
												disabled={contactIsLoading}
											/>
										))}
									</div>
									<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
										<Button
											type="button"
											onClick={handleVerifyContactOtp}
											disabled={contactIsLoading || contactOtp.join('').length !== 6}
										>
											{contactIsLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
											Verify Code
										</Button>
										<Button
											type="button"
											variant="ghost"
											onClick={handleUpdateContactInfo}
											disabled={contactCooldown > 0 || contactIsLoading}
										>
											{contactCooldown > 0 ? `Resend in ${contactCooldown}s` : 'Resend code'}
										</Button>
									</div>
								</div>
							)}
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
									<div className="text-sm text-muted-foreground">Verify by OTP before updating.</div>
								</div>
								<Button
									variant="outline"
									onClick={() => {
										setPasswordError('');
										setPasswordSuccess('');
										setPasswordStep('request');
									}}
								>
									Change Password
								</Button>
							</div>

							{passwordError && (
								<div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
									{passwordError}
								</div>
							)}

							{passwordSuccess && (
								<div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
									{passwordSuccess}
								</div>
							)}

							{renderPasswordFlow()}
						</CardContent>
					</Card>
				</PageTabsContent>

				<PageTabsContent value="notifications" className="space-y-6">
					<NotificationPreferencesPanel />
				</PageTabsContent>

				<PageTabsContent value="appearance" className="space-y-6">
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
						</CardContent>
					</Card>
				</PageTabsContent>
			</PageTabs>
		</PageShell>
	);
}
