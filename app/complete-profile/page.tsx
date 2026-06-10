'use client';

import type React from 'react';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { Loader2, MapPin, LocateFixed, UserCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DatePicker } from '@/components/ui/date-picker';
import { format, subYears, isBefore } from 'date-fns';
import AuthSplitLayout from '@/components/auth/AuthSplitLayout';

function CompleteProfileContent() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const { update } = useSession();
	const callbackUrl = searchParams.get('callbackUrl') || '/home';

	const [dob, setDob] = useState<Date | undefined>(undefined);
	const [city, setCity] = useState('');
	const [latitude, setLatitude] = useState<number | null>(null);
	const [longitude, setLongitude] = useState<number | null>(null);
	const [isLocating, setIsLocating] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [agreedToPolicies, setAgreedToPolicies] = useState(false);
	const [error, setError] = useState('');

	const handleUseLocation = () => {
		if (!navigator.geolocation) {
			setError('Geolocation is not supported by your browser.');
			return;
		}
		setIsLocating(true);
		navigator.geolocation.getCurrentPosition(
			async position => {
				const { latitude: lat, longitude: lng } = position.coords;
				setLatitude(lat);
				setLongitude(lng);
				try {
					const res = await fetch(
						`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
					);
					if (res.ok) {
						const data = await res.json();
						const cityName =
							data.address?.city ||
							data.address?.town ||
							data.address?.village ||
							data.address?.county ||
							'';
						if (cityName) setCity(cityName);
					}
				} catch {
					// Ignore reverse-geocode failures; coordinates are still captured
				}
				setIsLocating(false);
			},
			() => {
				setError('Unable to retrieve your location. You can enter your city manually.');
				setIsLocating(false);
			},
			{ timeout: 8000 },
		);
	};

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

		setIsSaving(true);
		try {
			const response = await fetch('/api/user/complete-profile', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					dateOfBirth: format(dob, 'yyyy-MM-dd'),
					latitude: latitude ?? undefined,
					longitude: longitude ?? undefined,
					city: city.trim() || undefined,
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

				<div>
					<label className="block text-sm font-medium mb-2">
						Location <span className="text-muted-foreground text-xs">(optional)</span>
					</label>
					<div className="flex gap-2">
						<Input
							type="text"
							placeholder="Your city"
							value={city}
							onChange={e => setCity(e.target.value)}
							className="flex-1"
							disabled={isSaving}
						/>
						<Button
							type="button"
							variant="outline"
							size="icon"
							onClick={handleUseLocation}
							disabled={isSaving || isLocating}
							title="Use my location"
						>
							{isLocating ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								<LocateFixed className="h-4 w-4" />
							)}
						</Button>
					</div>
					{latitude && longitude && (
						<p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
							<MapPin className="h-3 w-3" />
							Location captured{city ? ` · ${city}` : ''}
						</p>
					)}
					<p className="text-xs text-muted-foreground mt-1">
						Click the pin icon to auto-detect, or type your city manually.
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
							Add your date of birth (and location, if you like) to finish.
						</p>
					</div>
				}
			>
				<CompleteProfileContent />
			</AuthSplitLayout>
		</Suspense>
	);
}
