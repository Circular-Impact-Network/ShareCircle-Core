'use client';

import type React from 'react';

import { useState, useEffect, Suspense, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Mail, ArrowLeft, Lock, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import AuthSplitLayout from '@/components/auth/AuthSplitLayout';

type LoginMode = 'login' | 'forgot' | 'reset';

function LoginContent() {
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');
	const [loginFlow, setLoginFlow] = useState<'password' | 'otp'>('password');
	const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
	const [otpCooldown, setOtpCooldown] = useState(0);
	const [isOtpSending, setIsOtpSending] = useState(false);
	const [isOtpVerifying, setIsOtpVerifying] = useState(false);
	const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);
	const [phoneNumber, setPhoneNumber] = useState('');
	const [countryCode, setCountryCode] = useState('+91');
	const [loginMethod, setLoginMethod] = useState<'email' | 'phone'>('email');
	const [mode, setMode] = useState<LoginMode>('login');
	const [resetToken, setResetToken] = useState('');
	const [forgotSuccess, setForgotSuccess] = useState(false);
	const [resetSuccess, setResetSuccess] = useState(false);
	const [error, setError] = useState('');
	const [successMessage, setSuccessMessage] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	const [isGoogleLoading, setIsGoogleLoading] = useState(false);
	const [lastLoginMethod, setLastLoginMethod] = useState('');
	const router = useRouter();
	const searchParams = useSearchParams();
	const callbackUrl = searchParams.get('callbackUrl') || '/home';
	const verified = searchParams.get('verified');
	const modeParam = searchParams.get('mode');
	const tokenParam = searchParams.get('token');
	const emailParam = searchParams.get('email');

	// Show success message if redirected from email verification
	useEffect(() => {
		if (verified === 'true') {
			setSuccessMessage('Email verified successfully! Please log in to continue.');
		}
	}, [verified]);

	useEffect(() => {
		if (typeof window === 'undefined') return;
		const saved = window.localStorage.getItem('sc:lastLoginMethod');
		if (saved) {
			setLastLoginMethod(saved);
		}
	}, []);

	useEffect(() => {
		if (otpCooldown > 0) {
			const timer = setTimeout(() => setOtpCooldown(otpCooldown - 1), 1000);
			return () => clearTimeout(timer);
		}
	}, [otpCooldown]);

	useEffect(() => {
		if (loginFlow === 'otp') {
			otpInputRefs.current[0]?.focus();
		}
	}, [loginFlow]);

	useEffect(() => {
		if (emailParam) {
			setEmail(emailParam);
		}

		if (tokenParam) {
			setResetToken(tokenParam);
			setMode('reset');
			return;
		}

		if (modeParam === 'forgot' || modeParam === 'reset') {
			setMode(modeParam);
		}
	}, [emailParam, modeParam, tokenParam]);

	const updateMode = (nextMode: LoginMode, params?: { token?: string; email?: string }) => {
		setError('');
		setSuccessMessage('');
		setResetSuccess(false);
		setIsLoading(false);
		setIsOtpSending(false);
		setIsOtpVerifying(false);
		if (nextMode !== 'forgot') {
			setForgotSuccess(false);
		}
		if (nextMode !== 'reset') {
			setResetToken('');
			setPassword('');
			setConfirmPassword('');
		}
		if (params?.token) {
			setResetToken(params.token);
		}
		if (nextMode !== 'login') {
			setLoginFlow('password');
			setOtpCode(['', '', '', '', '', '']);
			setOtpCooldown(0);
		}

		const query = new URLSearchParams();
		if (callbackUrl) {
			query.set('callbackUrl', callbackUrl);
		}
		if (nextMode !== 'login') {
			query.set('mode', nextMode);
		}
		if (params?.token) {
			query.set('token', params.token);
		}
		if (params?.email) {
			query.set('email', params.email);
		}

		const queryString = query.toString();
		router.push(queryString ? `/login?${queryString}` : '/login');
		setMode(nextMode);
	};

	const handleLogin = async (e: React.FormEvent) => {
		e.preventDefault();
		setError('');
		setIsLoading(true);

		try {
			// Prevent phone login (disabled for MVP)
			if (loginMethod === 'phone') {
				setError('');
				setIsLoading(false);
				return;
			}

			if (loginMethod === 'email') {
				if (!email || !password) {
					setError('Please fill in all fields');
					setIsLoading(false);
					return;
				}

				if (!email.includes('@')) {
					setError('Please enter a valid email');
					setIsLoading(false);
					return;
				}

				const result = await signIn('credentials', {
					email,
					password,
					redirect: false,
				});

				if (result?.error) {
					const message = result.error === 'CredentialsSignin' ? 'Invalid email or password.' : result.error;
					setError(message);
					setIsLoading(false);
					return;
				}

				if (typeof window !== 'undefined') {
					window.localStorage.setItem('sc:lastLoginMethod', 'email_password');
					setLastLoginMethod('email_password');
				}
				setIsLoading(false);
			} else {
				// Phone login logic
				if (!phoneNumber) {
					setError('Please enter your phone number');
					setIsLoading(false);
					return;
				}

				// TODO: Implement actual phone auth provider
				// For now, we'll just simulate a delay or show an error
				setError('Phone authentication is not yet fully implemented on the backend.');
				setIsLoading(false);
				return;
			}

			// Redirect to callbackUrl if present, otherwise dashboard
			router.push(callbackUrl);
			router.refresh();
		} catch {
			setError('Login failed. Please try again.');
			setIsLoading(false);
		}
	};

	const handleGoogleLogin = async () => {
		setIsGoogleLoading(true);
		try {
			if (typeof window !== 'undefined') {
				window.localStorage.setItem('sc:lastLoginMethod', 'google');
				setLastLoginMethod('google');
			}
			await signIn('google', { callbackUrl });
		} catch {
			setIsGoogleLoading(false);
		}
	};

	const handleSendLoginOtp = async () => {
		setError('');
		setSuccessMessage('');

		if (!email || !email.includes('@')) {
			setError('Please enter a valid email address');
			return;
		}

		setIsOtpSending(true);
		try {
			const response = await fetch('/api/auth/resend-otp', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: email.toLowerCase().trim(), purpose: 'login_otp' }),
			});
			const data = await response.json();
			if (!response.ok) {
				setError(data.error || 'Failed to send login code.');
				setIsOtpSending(false);
				return;
			}
			setSuccessMessage('A login code has been sent to your email.');
			setOtpCooldown(60);
			setOtpCode(['', '', '', '', '', '']);
			otpInputRefs.current[0]?.focus();
		} catch {
			setError('Failed to send login code. Please try again.');
		} finally {
			setIsOtpSending(false);
		}
	};

	const handleOtpInputChange = (index: number, value: string) => {
		if (!/^\d*$/.test(value)) return;
		const next = [...otpCode];
		next[index] = value.slice(-1);
		setOtpCode(next);
		setError('');

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

	const handleLoginWithOtp = async () => {
		setError('');
		setSuccessMessage('');

		if (!email || !email.includes('@')) {
			setError('Please enter a valid email address');
			return;
		}

		const code = otpCode.join('');
		if (code.length !== 6) {
			setError('Please enter the 6-digit code');
			return;
		}

		setIsOtpVerifying(true);
		try {
			const result = await signIn('credentials', {
				email,
				code,
				redirect: false,
			});
			if (result?.error) {
				const message = result.error === 'CredentialsSignin' ? 'Invalid code. Please try again.' : result.error;
				setError(message);
				setIsOtpVerifying(false);
				return;
			}
			setIsOtpVerifying(false);
			if (typeof window !== 'undefined') {
				window.localStorage.setItem('sc:lastLoginMethod', 'email_otp');
				setLastLoginMethod('email_otp');
			}
			router.push(callbackUrl);
			router.refresh();
		} catch {
			setError('Login failed. Please try again.');
			setIsOtpVerifying(false);
		}
	};

	const handleForgotPassword = async (e: React.FormEvent) => {
		e.preventDefault();
		setError('');

		if (!email) {
			setError('Please enter your email address');
			return;
		}

		if (!email.includes('@')) {
			setError('Please enter a valid email address');
			return;
		}

		setIsLoading(true);

		try {
			const response = await fetch('/api/auth/forgot-password', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: email.toLowerCase().trim() }),
			});

			const data = await response.json();

			if (!response.ok) {
				setError(data.error || 'Something went wrong. Please try again.');
				setIsLoading(false);
				return;
			}

			setForgotSuccess(true);
		} catch {
			setError('An error occurred. Please try again.');
		} finally {
			setIsLoading(false);
		}
	};

	const handleResetPassword = async (e: React.FormEvent) => {
		e.preventDefault();
		setError('');

		if (!resetToken) {
			setError('Invalid reset link. Please request a new password reset.');
			return;
		}

		if (!password || !confirmPassword) {
			setError('Please fill in all fields');
			return;
		}

		if (password.length < 8) {
			setError('Password must be at least 8 characters');
			return;
		}

		if (password !== confirmPassword) {
			setError('Passwords do not match');
			return;
		}

		setIsLoading(true);

		try {
			const response = await fetch('/api/auth/reset-password', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ token: resetToken, password }),
			});

			const data = await response.json();

			if (!response.ok) {
				setError(data.error || 'Something went wrong. Please try again.');
				setIsLoading(false);
				return;
			}

			setResetSuccess(true);
			setSuccessMessage('Password reset successfully. Please log in.');
			setIsLoading(false);
			setTimeout(() => updateMode('login'), 1500);
		} catch {
			setError('An error occurred. Please try again.');
			setIsLoading(false);
		}
	};

	const formatLastLogin = (method: string) => {
		switch (method) {
			case 'google':
				return 'Google';
			case 'email_password':
				return 'Email + password';
			case 'email_otp':
				return 'Email + OTP';
			default:
				return '';
		}
	};

	const renderHeader = () => {
		if (mode === 'forgot') {
			return (
				<div className="mb-8">
					<button
						type="button"
						onClick={() => updateMode('login')}
						className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
					>
						<ArrowLeft className="w-4 h-4" />
						Back to login
					</button>
					<div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
						<Mail className="w-6 h-6 text-primary" />
					</div>
					<h1 className="text-3xl font-display font-bold mb-2">Forgot Password?</h1>
					<p className="text-muted-foreground">
						Enter your email and we&apos;ll send a reset link. If you used Google before, this will let you
						set a password for email login.
					</p>
				</div>
			);
		}

		if (mode === 'reset') {
			return (
				<div className="mb-8">
					<button
						type="button"
						onClick={() => updateMode('login')}
						className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
					>
						<ArrowLeft className="w-4 h-4" />
						Back to login
					</button>
					<div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
						<Lock className="w-6 h-6 text-primary" />
					</div>
					<h1 className="text-3xl font-display font-bold mb-2">Reset Password</h1>
					<p className="text-muted-foreground">
						Enter a new password for your account. This enables email login if you previously used Google.
					</p>
				</div>
			);
		}

		return (
			<div className="mb-8">
				<h1 className="text-3xl font-display font-bold mb-2">Login</h1>
				<p className="text-muted-foreground">Enter your credentials to access your account</p>
				{lastLoginMethod && (
					<div className="mt-3 inline-flex items-center rounded-full border px-3 py-1 text-xs text-muted-foreground">
						Last used: {formatLastLogin(lastLoginMethod)}
					</div>
				)}
			</div>
		);
	};

	const renderContent = () => {
		if (mode === 'forgot') {
			if (forgotSuccess) {
				return (
					<div className="text-center">
						<div className="mb-6 flex justify-center">
							<div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
								<CheckCircle2 className="w-8 h-8 text-green-600" />
							</div>
						</div>
						<h2 className="text-xl font-semibold mb-2">Check your email</h2>
						<p className="text-muted-foreground mb-6">
							If an account exists for <span className="font-medium text-foreground">{email}</span>, you
							will receive a reset link shortly.
						</p>
						<Button variant="outline" className="w-full h-11" onClick={() => updateMode('login')}>
							Back to login
						</Button>
					</div>
				);
			}

			return (
				<form onSubmit={handleForgotPassword} className="space-y-4">
					<div>
						<label className="block text-sm font-medium mb-2">Email</label>
						<Input
							type="email"
							placeholder="you@example.com"
							value={email}
							onChange={e => setEmail(e.target.value)}
							className="w-full h-11"
							disabled={isLoading}
							autoFocus
						/>
					</div>
					<Button type="submit" className="w-full h-11" disabled={isLoading}>
						{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
						{isLoading ? 'Sending...' : 'Send Reset Link'}
					</Button>
				</form>
			);
		}

		if (mode === 'reset') {
			if (!resetToken && !resetSuccess) {
				return (
					<div className="text-center">
						<div className="mb-6 flex justify-center">
							<div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
								<AlertTriangle className="w-8 h-8 text-destructive" />
							</div>
						</div>
						<h2 className="text-xl font-semibold mb-2">Invalid Reset Link</h2>
						<p className="text-muted-foreground mb-6">
							This reset link is invalid or has expired. Please request a new one.
						</p>
						<Button className="w-full h-11" onClick={() => updateMode('forgot')}>
							Request New Reset Link
						</Button>
					</div>
				);
			}

			if (resetSuccess) {
				return (
					<div className="text-center">
						<div className="mb-6 flex justify-center">
							<div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
								<CheckCircle2 className="w-8 h-8 text-green-600" />
							</div>
						</div>
						<h2 className="text-xl font-semibold mb-2">Password Updated</h2>
						<p className="text-muted-foreground mb-6">You can now log in with your new password.</p>
						<Button className="w-full h-11" onClick={() => updateMode('login')}>
							Continue to login
						</Button>
					</div>
				);
			}

			return (
				<form onSubmit={handleResetPassword} className="space-y-4">
					<div>
						<label className="block text-sm font-medium mb-2">New Password</label>
						<Input
							type="password"
							placeholder="••••••••"
							value={password}
							onChange={e => setPassword(e.target.value)}
							className="w-full h-11"
							disabled={isLoading}
							autoFocus
						/>
						<p className="text-xs text-muted-foreground mt-1">Must be at least 8 characters</p>
					</div>
					<div>
						<label className="block text-sm font-medium mb-2">Confirm New Password</label>
						<Input
							type="password"
							placeholder="••••••••"
							value={confirmPassword}
							onChange={e => setConfirmPassword(e.target.value)}
							className="w-full h-11"
							disabled={isLoading}
						/>
					</div>
					<Button type="submit" className="w-full h-11" disabled={isLoading}>
						{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
						{isLoading ? 'Resetting...' : 'Reset Password'}
					</Button>
				</form>
			);
		}

		return (
			<>
				<div className="flex items-center justify-between mb-4 text-sm">
					<span className="text-muted-foreground">
						{loginFlow === 'password' ? 'Use your password' : 'Use a one-time code'}
					</span>
					<button
						type="button"
						onClick={() => {
							setLoginFlow(loginFlow === 'password' ? 'otp' : 'password');
							setError('');
							setSuccessMessage('');
							setOtpCode(['', '', '', '', '', '']);
							setOtpCooldown(0);
						}}
						className="text-primary font-medium hover:underline"
					>
						{loginFlow === 'password' ? 'Login with OTP' : 'Login with password'}
					</button>
				</div>

				{loginFlow === 'password' ? (
					<Tabs
						defaultValue="email"
						className="w-full"
						onValueChange={v => {
							if (v === 'phone') return; // Prevent switching to phone tab
							setLoginMethod(v as 'email' | 'phone');
						}}
					>
						<TabsList className="grid w-full grid-cols-2 mb-6">
							<TabsTrigger value="email">Email</TabsTrigger>
							<Tooltip>
								<TooltipTrigger asChild>
									<div className="flex w-full">
										<TabsTrigger value="phone" disabled className="flex-1">
											Phone
										</TabsTrigger>
									</div>
								</TooltipTrigger>
								<TooltipContent>
									<p>Coming soon</p>
								</TooltipContent>
							</Tooltip>
						</TabsList>

						<form onSubmit={handleLogin} className="space-y-4">
							<TabsContent value="email" className="space-y-4 mt-0">
								<div>
									<label className="block text-sm font-medium mb-2">Email</label>
									<Input
										type="email"
										placeholder="you@example.com"
										value={email}
										onChange={e => setEmail(e.target.value)}
										className="w-full"
										disabled={isLoading}
									/>
								</div>

								<div>
									<div className="flex items-center justify-between mb-2">
										<label className="block text-sm font-medium">Password</label>
										<button
											type="button"
											onClick={() => updateMode('forgot', { email })}
											className="text-sm text-primary hover:underline"
										>
											Forgot Password?
										</button>
									</div>
									<Input
										type="password"
										placeholder="••••••••"
										value={password}
										onChange={e => setPassword(e.target.value)}
										className="w-full"
										disabled={isLoading}
									/>
								</div>
							</TabsContent>

							<TabsContent value="phone" className="space-y-4 mt-0">
								<Tooltip>
									<TooltipTrigger asChild>
										<div>
											<label className="block text-sm font-medium mb-2">Phone Number</label>
											<div className="flex gap-2">
												<Select value={countryCode} onValueChange={setCountryCode} disabled>
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
												<Input
													type="tel"
													placeholder="1234567890"
													value={phoneNumber}
													onChange={e => setPhoneNumber(e.target.value)}
													className="flex-1"
													disabled
												/>
											</div>
										</div>
									</TooltipTrigger>
									<TooltipContent>
										<p>Coming soon</p>
									</TooltipContent>
								</Tooltip>
							</TabsContent>

							<Button
								type="submit"
								className="w-full bg-primary hover:bg-primary/90 text-lg h-11"
								disabled={isLoading}
							>
								{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
								{isLoading ? 'Logging in...' : 'Login'}
							</Button>
						</form>
					</Tabs>
				) : (
					<div className="space-y-4">
						<div>
							<label className="block text-sm font-medium mb-2">Email</label>
							<Input
								type="email"
								placeholder="you@example.com"
								value={email}
								onChange={e => setEmail(e.target.value)}
								className="w-full"
								disabled={isOtpSending || isOtpVerifying}
							/>
						</div>
						<div className="flex items-center justify-between text-sm">
							<span className="text-muted-foreground">Enter the 6-digit code</span>
							<button
								type="button"
								onClick={handleSendLoginOtp}
								disabled={isOtpSending || otpCooldown > 0}
								className="text-primary font-medium hover:underline disabled:opacity-50"
							>
								{otpCooldown > 0 ? `Resend in ${otpCooldown}s` : 'Send code'}
							</button>
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
									disabled={isOtpVerifying}
								/>
							))}
						</div>
						<Button
							type="button"
							className="w-full bg-primary hover:bg-primary/90 text-lg h-11"
							onClick={handleLoginWithOtp}
							disabled={isOtpVerifying || otpCode.join('').length !== 6}
						>
							{isOtpVerifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
							{isOtpVerifying ? 'Verifying...' : 'Login'}
						</Button>
					</div>
				)}

				<div className="relative my-6">
					<div className="absolute inset-0 flex items-center">
						<span className="w-full border-t" />
					</div>
					<div className="relative flex justify-center text-xs uppercase">
						<span className="bg-background px-2 text-muted-foreground">Or continue with</span>
					</div>
				</div>

				<Button
					type="button"
					variant="outline"
					className="w-full h-11"
					onClick={handleGoogleLogin}
					disabled={isGoogleLoading || isLoading}
				>
					{isGoogleLoading ? (
						<Loader2 className="mr-2 h-4 w-4 animate-spin" />
					) : (
						<svg
							className="mr-2 h-4 w-4"
							aria-hidden="true"
							focusable="false"
							data-prefix="fab"
							data-icon="google"
							role="img"
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 488 512"
						>
							<path
								fill="currentColor"
								d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"
							></path>
						</svg>
					)}
					Sign in with Google
				</Button>

				<p className="text-center text-muted-foreground mt-6">
					Don&apos;t have an account?{' '}
					<Link
						href={callbackUrl ? `/signup?callbackUrl=${encodeURIComponent(callbackUrl)}` : '/signup'}
						className="text-primary font-semibold hover:underline"
					>
						Sign up
					</Link>
				</p>
			</>
		);
	};

	return (
		<AuthSplitLayout
			leftTitle="Welcome Back"
			leftDescription="Share items, build community, and make a difference together."
			rightHeader={renderHeader()}
		>
			{successMessage && (
				<Alert className="mb-6 border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
					<AlertDescription>{successMessage}</AlertDescription>
				</Alert>
			)}

			{error && (
				<Alert variant="destructive" className="mb-6">
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			)}

			{renderContent()}
		</AuthSplitLayout>
	);
}

export default function Login() {
	return (
		<Suspense
			fallback={
				<div className="min-h-[100dvh] flex items-center justify-center bg-background">
					<div className="text-center">
						<p className="text-muted-foreground">Loading...</p>
					</div>
				</div>
			}
		>
			<LoginContent />
		</Suspense>
	);
}
