'use client';

import type React from 'react';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { Loader2, MapPin, LocateFixed, UserCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DatePicker } from '@/components/ui/date-picker';
import { format, subYears, isBefore } from 'date-fns';
import AuthSplitLayout from '@/components/auth/AuthSplitLayout';
import { useGeolocation } from '@/hooks/useGeolocation';

function CompleteProfileContent() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const { update } = useSession();
	const callbackUrl = searchParams.get('callbackUrl') || '/home';

	const [dob, setDob] = useState<Date | undefined>(undefined);
	const [city, setCity] = useState('');
	const [stateRegion, setStateRegion] = useState('');
	const [zipCode, setZipCode] = useState('');
	const [countryName, setCountryName] = useState('');
	const [latitude, setLatitude] = useState<number | null>(null);
	const [longitude, setLongitude] = useState<number | null>(null);
	const { locate, isLocating, error: geoError } = useGeolocation();
	const [isSaving, setIsSaving] = useState(false);
	const [agreedToPolicies, setAgreedToPolicies] = useState(false);
	const [error, setError] = useState('');
	const [locationError, setLocationError] = useState<string | null>(null);
	const [approximateLocation, setApproximateLocation] = useState(false);

	const handleUseLocation = useCallback(async () => {
		const result = await locate();
		if (!result?.city) {
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

	// Location is required here too, so detect on mount rather than waiting for a click.
	useEffect(() => {
		void handleUseLocation();
		// Mount-only by design.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError('');

		if (!dob) {
			setError('Please enter your date of birth.');
			return;
		}
		if (!isBefore(dob, subYears(new Date(), 13))) {
			setError('You must be at least 13 years old.');
			return;
		}
		if (!agreedToPolicies) {
			setError('Please accept the Terms of Service and Privacy Policy to continue.');
			return;
		}
		// Checked last: a missing location should not mask a fixable field error above.
		if (!city.trim()) {
			setError('We need your location to continue. Tap Retry next to Location.');
			if (!isLocating) {
				void handleUseLocation();
			}
			return;
		}

		setIsSaving(true);
		try {
			const response = await fetch('/api/user/complete-profile', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					dateOfBirth: format(dob, 'yyyy-MM-dd'),
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
				setError(data.error || 'Failed to save. Please try again.');
				setIsSaving(false);
				return;
			}

			// Refresh the session token so the middleware sees profileComplete=true
			await update();
			router.push(callbackUrl);
			router.refresh();
		} catch {
			setError('Something went wrong. Please try again.');
			setIsSaving(false);
		}
	};

	return (
		<>
			{error && (
				<Alert variant="destructive" className="mb-6">
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			)}

			<form onSubmit={handleSubmit} className="space-y-4">
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

				{/* Location is required and always detected — no manual input, matching signup. */}
				<div>
					<label className="block text-sm font-medium mb-2">
						Location <span className="text-destructive">*</span>
					</label>
					<div
						className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2.5"
						data-testid="profile-location"
					>
						{isLocating ? (
							<>
								<Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
								<span className="text-sm text-muted-foreground">Detecting your location…</span>
							</>
						) : city ? (
							<>
								<MapPin className="h-4 w-4 shrink-0 text-emerald-600" />
								<span className="text-sm font-medium" data-testid="profile-location-value">
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
								disabled={isSaving}
								data-testid="profile-location-retry"
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
						disabled={isSaving}
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

				<Button type="submit" className="w-full text-lg h-11" disabled={isSaving || !agreedToPolicies}>
					{isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
					{isSaving ? 'Saving...' : 'Continue'}
				</Button>
			</form>

			<p className="text-center text-muted-foreground mt-6 text-sm">
				Wrong account?{' '}
				<button
					type="button"
					onClick={() => signOut({ callbackUrl: '/login' })}
					className="text-primary font-semibold hover:underline"
				>
					Sign out
				</button>
			</p>
		</>
	);
}

export default function CompleteProfilePage() {
	return (
		<Suspense
			fallback={
				<div className="min-h-[100dvh] flex items-center justify-center bg-background">
					<p className="text-muted-foreground">Loading...</p>
				</div>
			}
		>
			<AuthSplitLayout
				leftTitle="Almost there"
				leftDescription="Just a couple more details so your circles know who they're sharing with."
				rightHeader={
					<div className="mb-8">
						<div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
							<UserCircle2 className="w-6 h-6 text-primary" />
						</div>
						<h1 className="text-3xl font-display font-bold mb-2">Complete your profile</h1>
						<p className="text-muted-foreground">
							Your date of birth and location are both required before you can continue.
						</p>
					</div>
				}
			>
				<CompleteProfileContent />
			</AuthSplitLayout>
		</Suspense>
	);
}
