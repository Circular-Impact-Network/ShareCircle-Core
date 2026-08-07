'use client';

import type React from 'react';

import { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Mail, ArrowLeft, MapPin, LocateFixed } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DatePicker } from '@/components/ui/date-picker';
import { format, subYears, isBefore } from 'date-fns';
import AuthSplitLayout from '@/components/auth/AuthSplitLayout';
import { EMPTY_OTP, OtpInput } from '@/components/auth/OtpInput';
import { useGeolocation } from '@/hooks/useGeolocation';
import {
	PHONE_COUNTRIES,
	SupportedPhoneCountry,
	getDialCodeForCountry,
	isSupportedPhoneCountry,
	validatePhoneByCountry,
} from '@/lib/phone';
import { PHONE_AUTH_ENABLED } from '@/lib/feature-flags';
import { ComingSoonPill } from '@/components/ui/coming-soon-pill';
import { PasswordRequirements } from '@/components/auth/PasswordRequirements';
import { getPasswordRequirementsText, isPasswordAcceptable } from '@/lib/password-validation';
import { shouldNavigateAfterSignIn, signInError, signInWithTimeout } from '@/lib/auth-client';
import { safeRedirectPath } from '@/lib/safe-redirect';

type SignupMode = 'signup' | 'verify';

function SignupContent() {
	const [name, setName] = useState('');
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');
	const [phoneNumber, setPhoneNumber] = useState('');
	const [country, setCountry] = useState<SupportedPhoneCountry>('IN');
	const [signupMethod, setSignupMethod] = useState<'email' | 'phone'>('email');
	const [dob, setDob] = useState<Date | undefined>(undefined);
	const [city, setCity] = useState('');
	const [stateRegion, setStateRegion] = useState('');
	const [zipCode, setZipCode] = useState('');
	const [countryName, setCountryName] = useState('');
	const [latitude, setLatitude] = useState<number | null>(null);
	const [longitude, setLongitude] = useState<number | null>(null);
	const [locationError, setLocationError] = useState<string | null>(null);
	const [approximateLocation, setApproximateLocation] = useState(false);
	const { locate, isLocating, error: geoError } = useGeolocation();
	const [verificationMethod, setVerificationMethod] = useState<'email' | 'phone'>('email');
	const [verificationPhone, setVerificationPhone] = useState('');
	const [verificationCountry, setVerificationCountry] = useState<SupportedPhoneCountry>('IN');
	const [error, setError] = useState('');
	const [successMessage, setSuccessMessage] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	const [isGoogleLoading, setIsGoogleLoading] = useState(false);
	const [agreedToPolicies, setAgreedToPolicies] = useState(false);
	const [mode, setMode] = useState<SignupMode>('signup');
	const [verificationStatus, setVerificationStatus] = useState<'idle' | 'verifying' | 'signing-in'>('idle');
	const [isVerifying, setIsVerifying] = useState(false);
	const [isResending, setIsResending] = useState(false);
	const [resendCooldown, setResendCooldown] = useState(0);
	const [code, setCode] = useState<string[]>(EMPTY_OTP);
	const router = useRouter();
	const searchParams = useSearchParams();
	const callbackUrl = safeRedirectPath(searchParams.get('callbackUrl'));
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

	// OTP cell auto-focus is handled inside OtpInput via the autoFocus prop.

	useEffect(() => {
		if (mode === 'signup') {
			setVerificationStatus('idle');
			setIsVerifying(false);
			setIsResending(false);
			setResendCooldown(0);
			setCode(EMPTY_OTP);
			// Belt-and-braces: returning to the signup form must always leave it usable, even
			// if some future path forgets to clear isLoading before switching modes.
			setIsLoading(false);
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

	/**
	 * Location is required and has no manual input, so submission blocks until detection
	 * succeeds. Checked AFTER the field validations: reporting a missing location before a
	 * mistyped password would bury the error the user can actually act on.
	 */
	const ensureLocationPresent = (): boolean => {
		if (city.trim()) {
			return true;
		}
		setError('We need your location to continue. Tap Retry next to Location.');
		setIsLoading(false);
		if (!isLocating) {
			void handleUseLocation();
		}
		return false;
	};

	const handleSignup = async (e: React.FormEvent) => {
		e.preventDefault();
		setError('');

		if (!agreedToPolicies) {
			setError('Please accept the Terms of Service and Privacy Policy to continue.');
			return;
		}

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

				// Same rule set the API enforces. The old `length < 6` check let a password
				// through that /api/auth/signup then rejected with a 400, so the form looked
				// broken; the live checklist under the field means this branch is now a
				// backstop rather than the user's first hint that anything is wrong.
				if (!isPasswordAcceptable(password)) {
					setError(getPasswordRequirementsText());
					setIsLoading(false);
					return;
				}

				if (password !== confirmPassword) {
					setError("Passwords don't match");
					setIsLoading(false);
					return;
				}

				if (!dob) {
					setError('Please enter your date of birth');
					setIsLoading(false);
					return;
				}

				if (!isBefore(dob, subYears(new Date(), 13))) {
					setError('You must be at least 13 years old to sign up');
					setIsLoading(false);
					return;
				}

				if (!ensureLocationPresent()) {
					return;
				}

				// Call signup API
				const response = await fetch('/api/auth/signup', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						name,
						email,
						password,
						dateOfBirth: dob ? format(dob, 'yyyy-MM-dd') : undefined,
						latitude: latitude ?? undefined,
						longitude: longitude ?? undefined,
						city: city.trim(),
						state: stateRegion.trim() || undefined,
						zipCode: zipCode.trim() || undefined,
						countryName: countryName.trim() || undefined,
					}),
				});

				const data = await response.json();

				if (!response.ok) {
					setError(data.error || 'Signup failed. Please try again.');
					setIsLoading(false);
					return;
				}

				// If email verification is required, switch to verify mode
				if (data.requiresVerification) {
					// Must clear isLoading before returning: every field and the submit button are
					// disabled={isLoading}, so leaving it set made "Back to signup" a dead form that
					// only a hard reload could recover.
					setIsLoading(false);
					setVerificationMethod('email');
					updateMode('verify', { email });
					// data.emailSent === false means the OTP email couldn't be sent (e.g. mail not
					// configured / send failed) — tell the user to resend instead of waiting on nothing.
					if (data.emailSent === false) {
						setSuccessMessage('');
						setError("We couldn't send your verification email. Tap Resend code to try again.");
					} else {
						setError('');
						setSuccessMessage('We sent a verification code to your email.');
					}
					return;
				}

				// Auto sign in after successful signup (if no verification required)
				const signInResult = await signInWithTimeout({ email, password });

				if (!shouldNavigateAfterSignIn(signInResult)) {
					console.error('Post-signup sign-in failed:', signInError(signInResult));
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

				if (!dob) {
					setError('Please enter your date of birth');
					setIsLoading(false);
					return;
				}

				if (!isBefore(dob, subYears(new Date(), 13))) {
					setError('You must be at least 13 years old to sign up');
					setIsLoading(false);
					return;
				}

				if (!ensureLocationPresent()) {
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
						dateOfBirth: dob ? format(dob, 'yyyy-MM-dd') : undefined,
						latitude: latitude ?? undefined,
						longitude: longitude ?? undefined,
						city: city.trim(),
						state: stateRegion.trim() || undefined,
						zipCode: zipCode.trim() || undefined,
						countryName: countryName.trim() || undefined,
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

			// Full reload (not router.push) so the freshly-set session cookie is picked up by
			// middleware without a client/server race — matches the login page and fixes the
			// "stuck at Signing in…" hang on first signup.
			window.location.href = callbackUrl;
		} catch {
			setError('Signup failed. Please try again.');
			setIsLoading(false);
		}
	};

	/**
	 * Deliberately NOT gated on the terms checkbox.
	 *
	 * That checkbox belongs to the email form below it, and gating Google on it was pure
	 * confusion: the button looked broken for anyone who hadn't scrolled past a form they
	 * weren't using. Google sign-ups always land on /complete-profile (they have no date of
	 * birth, so `profileComplete` is false and the middleware redirects them), and that page
	 * carries its own terms checkbox which blocks its submit. Acceptance is still captured
	 * before the user can reach the app — just at the step that actually applies to them.
	 */
	const handleGoogleLogin = async () => {
		setIsGoogleLoading(true);
		try {
			await signIn('google', { callbackUrl });
		} catch {
			setIsGoogleLoading(false);
		}
	};

	const handleUseLocation = useCallback(async () => {
		const result = await locate();
		if (!result?.city) {
			// The hook's message names the actual cause (blocked permission vs offline vs
			// unsupported); the old generic copy pointed at a manual input that no longer exists.
			setLocationError(geoError ?? 'We could not detect your location. Please try again.');
			return;
		}
		setLocationError(null);
		setApproximateLocation(result.approximate);
		setLatitude(result.latitude);
		setLongitude(result.longitude);
		setCity(result.city);
		setStateRegion(result.state);
		setZipCode(result.zipCode);
		setCountryName(result.country);
	}, [locate, geoError]);

	// Detect on mount. Location is required, so waiting for the user to press a button
	// (the old behaviour) just meant most people never triggered detection at all.
	//
	// Reads modeParam, not `mode`: on a /signup?mode=verify URL the state setter that flips
	// `mode` hasn't been applied yet when this effect runs, so gating on `mode` fired a
	// geolocation permission prompt over the OTP screen.
	useEffect(() => {
		if (modeParam === 'verify' || mode !== 'signup' || city || isLocating) {
			return;
		}
		void handleUseLocation();
		// Intentionally mount-only: re-running on every city/isLocating change would loop.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

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
				// Same bounded wait as the email path below — an unbounded await here strands
				// the user on "Signing you in…" for exactly the same reason.
				const signInResult = await signInWithTimeout({
					phone: verificationPhone,
					country: verificationCountry,
					code: codeToVerify,
				});

				if (!shouldNavigateAfterSignIn(signInResult)) {
					const reason = signInError(signInResult);
					setError(!reason || reason === 'CredentialsSignin' ? 'Invalid code. Please try again.' : reason);
					setIsVerifying(false);
					setVerificationStatus('idle');
					return;
				}

				window.location.href = callbackUrl;
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

			// Past this point the email IS verified — the server has already written
			// emailVerified. Whatever happens next must end in a navigation, never in an
			// indefinite spinner.
			setVerificationStatus('signing-in');

			if (password) {
				// Bounded wait — see signInWithTimeout for why an unbounded one hangs here.
				const signInOutcome = await signInWithTimeout({ email, password });

				if (shouldNavigateAfterSignIn(signInOutcome)) {
					window.location.href = callbackUrl;
					return;
				}

				// A genuine credential failure. Don't strand the user on the verify screen with a
				// code that has already been consumed — hand off to login, which shows the
				// "Email verified successfully" notice.
				console.error('Post-verification sign-in failed:', signInError(signInOutcome));
			}

			// No password in state: the page was reloaded, or reached via /verify-email or the
			// middleware redirect. Verification still succeeded, so send them to login rather
			// than leaving the spinner up.
			window.location.href = '/login?verified=true';
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
				setCode(EMPTY_OTP);
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
						<OtpInput
							value={code}
							onChange={next => {
								setCode(next);
								setError('');
							}}
							disabled={isVerifying}
							autoFocus={mode === 'verify'}
							onComplete={fullCode => handleVerify(fullCode)}
						/>
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
					{/* The Phone tab stays visible but disabled until the SMS provider is live, so
					    the missing option reads as "not yet" rather than as a broken page. */}
					<TabsList className="grid w-full grid-cols-2 mb-6">
						<TabsTrigger value="email">Email</TabsTrigger>
						<TabsTrigger
							value="phone"
							disabled={!PHONE_AUTH_ENABLED}
							data-testid="phone-signup-tab"
							className="gap-1.5"
						>
							Phone
							{!PHONE_AUTH_ENABLED && <ComingSoonPill />}
						</TabsTrigger>
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
								{/* Live, as-you-type. The rules used to only surface after a failed
								    submit — and the submit that surfaced them was the API's, not
								    the form's, so it read as a random rejection. */}
								<PasswordRequirements password={password} />
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
								{confirmPassword.length > 0 && password !== confirmPassword && (
									<p className="mt-1.5 text-2xs text-destructive" data-testid="confirm-mismatch">
										Passwords do not match yet.
									</p>
								)}
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

						{/* DOB — shared for both signup methods */}
						<div>
							<label className="block text-sm font-medium mb-2">
								Date of Birth <span className="text-destructive">*</span>
							</label>
							<DatePicker
								value={dob}
								onChange={setDob}
								placeholder="Select your date of birth"
								fromYear={1900}
								toYear={subYears(new Date(), 13).getFullYear()}
								disabled={{ after: subYears(new Date(), 13) }}
							/>
							<p className="text-xs text-muted-foreground mt-1">You must be at least 13 years old.</p>
						</div>

						{/* Location — required, always detected automatically. There is deliberately no
						    text input: a typed city cannot be trusted for matching people to nearby
						    circles, and the detection chain (GPS, then IP) always yields something on a
						    publicly-routable network. */}
						<div>
							<label className="block text-sm font-medium mb-2">Location</label>
							<div
								className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2.5"
								data-testid="signup-location"
							>
								{isLocating ? (
									<>
										<Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
										<span className="text-sm text-muted-foreground">Detecting your location…</span>
									</>
								) : city ? (
									<>
										<MapPin className="h-4 w-4 shrink-0 text-emerald-600" />
										<span className="text-sm font-medium" data-testid="signup-location-value">
											{[city, stateRegion, countryName].filter(Boolean).join(', ')}
										</span>
									</>
								) : (
									<>
										<MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
										<span className="text-sm text-muted-foreground">Location not detected yet</span>
									</>
								)}
								{!isLocating && (
									<Button
										type="button"
										variant="ghost"
										size="sm"
										className="ml-auto shrink-0 gap-1.5"
										onClick={handleUseLocation}
										disabled={isLoading}
										data-testid="signup-location-retry"
									>
										<LocateFixed className="h-3.5 w-3.5" />
										{city ? 'Update' : 'Retry'}
									</Button>
								)}
							</div>
							{locationError && <p className="text-xs text-destructive mt-1">{locationError}</p>}
							<p className="text-xs text-muted-foreground mt-1">
								{approximateLocation && city
									? 'Approximate location from your network. Allow location access for a more precise result.'
									: 'Detected automatically so we can connect you with circles nearby.'}
							</p>
						</div>

						<div className="flex items-start gap-2.5 pt-1">
							<Checkbox
								id="agree-policies"
								checked={agreedToPolicies}
								onCheckedChange={checked => {
									const next = checked === true;
									setAgreedToPolicies(next);
									if (next) setError('');
								}}
								disabled={isLoading}
								className="mt-0.5"
							/>
							<label htmlFor="agree-policies" className="text-sm leading-snug text-muted-foreground">
								I agree to ShareCircle&apos;s{' '}
								<Link
									href="/terms"
									target="_blank"
									rel="noopener noreferrer"
									className="font-medium text-primary hover:underline"
								>
									Terms of Service
								</Link>{' '}
								and{' '}
								<Link
									href="/privacy"
									target="_blank"
									rel="noopener noreferrer"
									className="font-medium text-primary hover:underline"
								>
									Privacy Policy
								</Link>
								.
							</label>
						</div>

						<Button
							type="submit"
							className="w-full bg-primary hover:bg-primary/90 text-lg h-11"
							disabled={isLoading || !agreedToPolicies}
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
					data-testid="google-signup-btn"
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

				<p className="mt-3 text-center text-2xs text-muted-foreground">
					You&apos;ll confirm the Terms of Service and Privacy Policy on the next step.
				</p>

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
