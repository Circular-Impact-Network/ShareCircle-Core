'use client';

import type React from 'react';

import { useState, useEffect, Suspense, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Loader2, Mail, ArrowLeft } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AuthSplitLayout from '@/components/auth/AuthSplitLayout';
import {
	PHONE_COUNTRIES,
	SupportedPhoneCountry,
	getDialCodeForCountry,
	isSupportedPhoneCountry,
	validatePhoneByCountry,
} from '@/lib/phone';

type SignupMode = 'signup' | 'verify';

function SignupContent() {
	const [name, setName] = useState('');
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');
	const [phoneNumber, setPhoneNumber] = useState('');
	const [country, setCountry] = useState<SupportedPhoneCountry>('IN');
	const [signupMethod, setSignupMethod] = useState<'email' | 'phone'>('email');
	const [verificationMethod, setVerificationMethod] = useState<'email' | 'phone'>('email');
	const [verificationPhone, setVerificationPhone] = useState('');
	const [verificationCountry, setVerificationCountry] = useState<SupportedPhoneCountry>('IN');
	const [error, setError] = useState('');
	const [successMessage, setSuccessMessage] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	const [isGoogleLoading, setIsGoogleLoading] = useState(false);
	const [mode, setMode] = useState<SignupMode>('signup');
	const [verificationStatus, setVerificationStatus] = useState<'idle' | 'verifying' | 'signing-in'>('idle');
	const [isVerifying, setIsVerifying] = useState(false);
	const [isResending, setIsResending] = useState(false);
	const [resendCooldown, setResendCooldown] = useState(0);
	const [code, setCode] = useState(['', '', '', '', '', '']);
	const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
	const router = useRouter();
	const searchParams = useSearchParams();
	const callbackUrl = searchParams.get('callbackUrl') || '/home';
	const modeParam = searchParams.get('mode');
	const emailParam = searchParams.get('email');

	useEffect(() => {
		if (emailParam) {
			setEmail(emailParam);
		}
		if (modeParam === 'verify') {
			setMode('verify');
		}
	}, [emailParam, modeParam]);

	useEffect(() => {
		if (resendCooldown > 0) {
			const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
			return () => clearTimeout(timer);
		}
	}, [resendCooldown]);

	useEffect(() => {
		if (mode === 'verify') {
			inputRefs.current[0]?.focus();
		}
	}, [mode]);

	useEffect(() => {
		if (mode === 'signup') {
			setVerificationStatus('idle');
			setIsVerifying(false);
			setIsResending(false);
			setResendCooldown(0);
			setCode(['', '', '', '', '', '']);
		}
	}, [mode]);

	const updateMode = (nextMode: SignupMode, params?: { email?: string }) => {
		setError('');
		setSuccessMessage('');
		const query = new URLSearchParams();
		if (callbackUrl) {
			query.set('callbackUrl', callbackUrl);
		}
		if (nextMode !== 'signup') {
			query.set('mode', nextMode);
		}
		if (params?.email) {
			query.set('email', params.email);
		}
		const queryString = query.toString();
		router.push(queryString ? `/signup?${queryString}` : '/signup');
		setMode(nextMode);
	};

	const handleSignup = async (e: React.FormEvent) => {
		e.preventDefault();
		setError('');
		setIsLoading(true);

		try {
			if (signupMethod === 'email') {
				if (!name || !email || !password || !confirmPassword) {
					setError('Please fill in all fields');
					setIsLoading(false);
					return;
				}

				if (!email.includes('@')) {
					setError('Please enter a valid email');
					setIsLoading(false);
					return;
				}

				if (password.length < 6) {
					setError('Password must be at least 6 characters');
					setIsLoading(false);
					return;
				}

				if (password !== confirmPassword) {
					setError("Passwords don't match");
					setIsLoading(false);
					return;
				}

				// Call signup API
				const response = await fetch('/api/auth/signup', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({ name, email, password }),
				});

				const data = await response.json();

				if (!response.ok) {
					setError(data.error || 'Signup failed. Please try again.');
					setIsLoading(false);
					return;
				}

				// If email verification is required, switch to verify mode
				if (data.requiresVerification) {
					setVerificationMethod('email');
					updateMode('verify', { email });
					setError('');
					setSuccessMessage('We sent a verification code to your email.');
					return;
				}

				// Auto sign in after successful signup (if no verification required)
				const signInResult = await signIn('credentials', {
					email,
					password,
					redirect: false,
				});

				if (signInResult?.error) {
					setError('Account created but login failed. Please try logging in.');
					setIsLoading(false);
					return;
				}
			}

			if (signupMethod === 'phone') {
				const phoneValidation = validatePhoneByCountry(phoneNumber, country);
				if (!phoneValidation.valid) {
					setError(phoneValidation.error || 'Please enter a valid phone number.');
					setIsLoading(false);
					return;
				}

				const response = await fetch('/api/auth/signup', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						name: name.trim() || 'User',
						phoneNumber,
						country,
					}),
				});

				const data = await response.json();
				if (!response.ok) {
					setError(data.error || 'Signup failed. Please try again.');
					setIsLoading(false);
					return;
				}

				setVerificationMethod('phone');
				setVerificationPhone(phoneNumber);
				setVerificationCountry(country);
				updateMode('verify');
				setSuccessMessage('We sent a verification code to your phone.');
				setIsLoading(false);
				return;
			}

			// Redirect to callbackUrl if present, otherwise dashboard
			router.push(callbackUrl);
		} catch {
			setError('Signup failed. Please try again.');
			setIsLoading(false);
		}
	};

	const handleGoogleLogin = async () => {
		setIsGoogleLoading(true);
		try {
			await signIn('google', { callbackUrl });
		} catch {
			setIsGoogleLoading(false);
		}
	};

	const handleInputChange = (index: number, value: string) => {
		if (!/^\d*$/.test(value)) return;
		const newCode = [...code];
		newCode[index] = value.slice(-1);
		setCode(newCode);
		setError('');

		if (value && index < 5) {
			inputRefs.current[index + 1]?.focus();
		}

		if (value && index === 5) {
			const fullCode = newCode.join('');
			if (fullCode.length === 6) {
				handleVerify(fullCode);
			}
		}
	};

	const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === 'Backspace' && !code[index] && index > 0) {
			inputRefs.current[index - 1]?.focus();
		}
	};

	const handlePaste = (e: React.ClipboardEvent) => {
		e.preventDefault();
		const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
		if (pastedData.length === 6) {
			const newCode = pastedData.split('');
			setCode(newCode);
			handleVerify(pastedData);
		}
	};

	const handleVerify = async (verificationCode?: string) => {
		const codeToVerify = verificationCode || code.join('');
		if (codeToVerify.length !== 6) {
			setError('Please enter the 6-digit code');
			return;
		}

		setIsVerifying(true);
		setVerificationStatus('verifying');
		setError('');

		try {
			if (verificationMethod === 'phone') {
				setVerificationStatus('signing-in');
				const signInResult = await signIn('credentials', {
					phone: verificationPhone,
					country: verificationCountry,
					code: codeToVerify,
					redirect: false,
				});

				if (signInResult?.error) {
					setError(
						signInResult.error === 'CredentialsSignin'
							? 'Invalid code. Please try again.'
							: signInResult.error,
					);
					setIsVerifying(false);
					setVerificationStatus('idle');
					return;
				}

				router.push(callbackUrl);
				router.refresh();
				return;
			}

			if (!email) {
				setError('Missing email. Please start signup again.');
				setIsVerifying(false);
				setVerificationStatus('idle');
				return;
			}

			const response = await fetch('/api/auth/verify-otp', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, code: codeToVerify, purpose: 'email_verification' }),
			});

			const data = await response.json();

			if (!response.ok) {
				setError(data.error || 'Verification failed');
				setIsVerifying(false);
				setVerificationStatus('idle');
				return;
			}

			setVerificationStatus('signing-in');

			if (password) {
				const signInResult = await signIn('credentials', {
					email,
					password,
					redirect: false,
				});

				if (signInResult?.ok) {
					router.push(callbackUrl);
					router.refresh();
					return;
				}
			}

			router.push('/login?verified=true');
		} catch {
			setError('An error occurred. Please try again.');
			setIsVerifying(false);
			setVerificationStatus('idle');
		}
	};

	const handleResend = async () => {
		if (resendCooldown > 0) return;

		setIsResending(true);
		setError('');

		try {
			let response: Response;
			if (verificationMethod === 'phone') {
				response = await fetch('/api/auth/resend-otp', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						phoneNumber: verificationPhone,
						country: verificationCountry,
						purpose: 'phone_signup',
					}),
				});
			} else {
				if (!email) {
					setError('Please enter your email first.');
					setIsResending(false);
					return;
				}
				response = await fetch('/api/auth/resend-otp', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ email, purpose: 'email_verification' }),
				});
			}

			const data = await response.json();

			if (!response.ok) {
				setError(data.error || 'Failed to resend code');
			} else {
				setResendCooldown(60);
				setCode(['', '', '', '', '', '']);
				inputRefs.current[0]?.focus();
				setSuccessMessage('A new verification code has been sent.');
			}
		} catch {
			setError('Failed to resend code. Please try again.');
		} finally {
			setIsResending(false);
		}
	};

	const renderHeader = () => {
		if (mode === 'verify') {
			return (
				<div className="mb-8">
					<button
						type="button"
						onClick={() => updateMode('signup')}
						className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
					>
						<ArrowLeft className="w-4 h-4" />
						Back to signup
					</button>
					<div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
						<Mail className="w-6 h-6 text-primary" />
					</div>
					<h1 className="text-3xl font-display font-bold mb-2">
						{verificationMethod === 'phone' ? 'Check your phone' : 'Check your email'}
					</h1>
					<p className="text-muted-foreground">
						We sent a verification code to{' '}
						<span className="font-medium text-foreground">
							{verificationMethod === 'phone'
								? `${getDialCodeForCountry(verificationCountry)} ${verificationPhone || 'your phone'}`
								: email || 'your email'}
						</span>
					</p>
				</div>
			);
		}

		return (
			<div className="mb-8">
				<h1 className="text-3xl font-display font-bold mb-2">Create Account</h1>
				<p className="text-muted-foreground">Join our community today</p>
			</div>
		);
	};

	const renderContent = () => {
		if (mode === 'verify') {
			if (verificationStatus === 'signing-in') {
				return (
					<div className="text-center">
						<Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
						<p className="text-muted-foreground">Signing you in...</p>
					</div>
				);
			}

			return (
				<>
					<div className="mb-6">
						<label className="block text-sm font-medium mb-3">Enter verification code</label>
						<div className="flex gap-2 sm:gap-3 justify-center" onPaste={handlePaste}>
							{code.map((digit, index) => (
								<Input
									key={index}
									ref={el => {
										inputRefs.current[index] = el;
									}}
									type="text"
									inputMode="numeric"
									maxLength={1}
									value={digit}
									onChange={e => handleInputChange(index, e.target.value)}
									onKeyDown={e => handleKeyDown(index, e)}
									className="w-12 h-14 text-center text-2xl font-bold"
									disabled={isVerifying}
								/>
							))}
						</div>
					</div>

					<div className="max-w-xs mx-auto">
						<Button
							onClick={() => handleVerify()}
							disabled={isVerifying || code.join('').length !== 6}
							className="w-full h-11 mb-4"
						>
							{isVerifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
							{verificationStatus === 'verifying'
								? 'Verifying...'
								: verificationMethod === 'phone'
									? 'Verify Phone'
									: 'Verify Email'}
						</Button>
					</div>

					<div className="text-center">
						<p className="text-sm text-muted-foreground">
							Didn&apos;t receive the code?{' '}
							<button
								onClick={handleResend}
								disabled={isResending || resendCooldown > 0}
								className="text-primary font-medium hover:underline disabled:opacity-50 disabled:no-underline"
							>
								{isResending ? (
									<span className="inline-flex items-center gap-1">
										<Loader2 className="w-3 h-3 animate-spin" />
										Sending...
									</span>
								) : resendCooldown > 0 ? (
									`Resend in ${resendCooldown}s`
								) : (
									'Resend code'
								)}
							</button>
						</p>
					</div>
				</>
			);
		}

		return (
			<>
				<Tabs
					value={signupMethod}
					className="w-full"
					onValueChange={v => setSignupMethod(v as 'email' | 'phone')}
				>
					<TabsList className="grid w-full grid-cols-2 mb-6">
						<TabsTrigger value="email">Email</TabsTrigger>
						<TabsTrigger value="phone">Phone</TabsTrigger>
					</TabsList>

					<form onSubmit={handleSignup} className="space-y-4">
						<TabsContent value="email" className="space-y-4 mt-0">
							<div>
								<label className="block text-sm font-medium mb-2">Full Name</label>
								<Input
									type="text"
									placeholder="John Doe"
									value={name}
									onChange={e => setName(e.target.value)}
									className="w-full"
									disabled={isLoading}
								/>
							</div>

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
								<label className="block text-sm font-medium mb-2">Password</label>
								<PasswordInput
									placeholder="••••••••"
									value={password}
									onChange={e => setPassword(e.target.value)}
									className="w-full"
									disabled={isLoading}
								/>
							</div>

							<div>
								<label className="block text-sm font-medium mb-2">Confirm Password</label>
								<PasswordInput
									placeholder="••••••••"
									value={confirmPassword}
									onChange={e => setConfirmPassword(e.target.value)}
									className="w-full"
									disabled={isLoading}
								/>
							</div>
						</TabsContent>

						<TabsContent value="phone" className="space-y-4 mt-0">
							<div className="space-y-4">
								<div>
									<label className="block text-sm font-medium mb-2">Full Name (optional)</label>
									<Input
										type="text"
										placeholder="User"
										value={name}
										onChange={e => setName(e.target.value)}
										className="w-full"
										disabled={isLoading}
									/>
								</div>

								<div>
									<label className="block text-sm font-medium mb-2">Phone Number</label>
									<div className="flex gap-2">
										<Select
											value={country}
											onValueChange={value => {
												if (isSupportedPhoneCountry(value)) {
													setCountry(value);
												}
											}}
											disabled={isLoading}
										>
											<SelectTrigger className="w-[130px]">
												<SelectValue placeholder="Country" />
											</SelectTrigger>
											<SelectContent>
												{PHONE_COUNTRIES.map(phoneCountry => (
													<SelectItem key={phoneCountry.iso2} value={phoneCountry.iso2}>
														{phoneCountry.flag} {getDialCodeForCountry(phoneCountry.iso2)}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										<Input
											type="tel"
											placeholder="Phone number"
											value={phoneNumber}
											onChange={e => setPhoneNumber(e.target.value)}
											className="flex-1"
											disabled={isLoading}
										/>
									</div>
									<p className="text-xs text-muted-foreground mt-1">
										You can sign up with phone only. If name is empty we will use &quot;User&quot;.
									</p>
								</div>
							</div>
						</TabsContent>

						<Button
							type="submit"
							className="w-full bg-primary hover:bg-primary/90 text-lg h-11"
							disabled={isLoading}
						>
							{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
							{isLoading ? 'Creating account...' : 'Create Account'}
						</Button>
					</form>
				</Tabs>

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
					Sign up with Google
				</Button>

				<p className="text-center text-muted-foreground mt-6">
					Already have an account?{' '}
					<Link
						href={callbackUrl ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}` : '/login'}
						className="text-primary font-semibold hover:underline"
					>
						Login
					</Link>
				</p>
			</>
		);
	};

	return (
		<AuthSplitLayout
			leftTitle="Get Started"
			leftDescription="Join thousands sharing items and building communities."
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

export default function Signup() {
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
			<SignupContent />
		</Suspense>
	);
}
