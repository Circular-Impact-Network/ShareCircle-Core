import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { validateDateOfBirth } from '@/lib/age-policy';

const completeProfileSchema = z.object({
	dateOfBirth: z.string().min(1, 'Date of birth is required'),
	latitude: z.number().min(-90).max(90).nullish(),
	longitude: z.number().min(-180).max(180).nullish(),
	// Required: location is mandatory and the client has no manual input, so a missing city
	// means detection was bypassed rather than declined.
	city: z.string().trim().min(1, 'Location is required.').max(120),
	state: z.string().trim().max(120).nullish(),
	zipCode: z.string().trim().max(20).nullish(),
	countryName: z.string().trim().max(120).nullish(),
});

// POST /api/user/complete-profile - capture profile data skipped by Google sign-up
export async function POST(req: NextRequest) {
	try {
		const session = await getServerSession(authOptions);
		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const parsed = completeProfileSchema.safeParse(await req.json());
		if (!parsed.success) {
			return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
		}

		const { dateOfBirth, latitude, longitude, city, state, zipCode, countryName } = parsed.data;

		// Shared with /api/auth/signup via lib/age-policy.ts. This block used to be a private copy
		// whose comment claimed it mirrored signup — signup had no check, so the claim was false
		// and there was nothing to mirror.
		const dateOfBirthResult = validateDateOfBirth(dateOfBirth);
		if ('error' in dateOfBirthResult) {
			return NextResponse.json({ error: dateOfBirthResult.error }, { status: 400 });
		}
		const dob = dateOfBirthResult.date;

		await prisma.user.update({
			where: { id: session.user.id },
			data: {
				date_of_birth: dob,
				...(latitude != null && { latitude }),
				...(longitude != null && { longitude }),
				// Unconditional: `city` is what the profile-completion gate checks, so a spread
				// that could skip it would loop the user back to this form forever.
				city,
				...(state && { state }),
				...(zipCode && { zip_code: zipCode }),
				...(countryName && { country: countryName }),
			},
		});

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error('Complete profile error:', error);
		return NextResponse.json({ error: 'Failed to save profile' }, { status: 500 });
	}
}
