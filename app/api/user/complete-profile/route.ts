import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const completeProfileSchema = z.object({
	dateOfBirth: z.string().min(1, 'Date of birth is required'),
	latitude: z.number().min(-90).max(90).nullish(),
	longitude: z.number().min(-180).max(180).nullish(),
	city: z.string().trim().max(120).nullish(),
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

		const { dateOfBirth, latitude, longitude, city } = parsed.data;

		const dob = new Date(dateOfBirth);
		if (Number.isNaN(dob.getTime())) {
			return NextResponse.json({ error: 'Invalid date of birth' }, { status: 400 });
		}

		// Must be at least 13 years old (mirrors signup)
		const thirteenYearsAgo = new Date();
		thirteenYearsAgo.setFullYear(thirteenYearsAgo.getFullYear() - 13);
		if (dob > thirteenYearsAgo) {
			return NextResponse.json({ error: 'You must be at least 13 years old.' }, { status: 400 });
		}

		await prisma.user.update({
			where: { id: session.user.id },
			data: {
				date_of_birth: dob,
				...(latitude != null && { latitude }),
				...(longitude != null && { longitude }),
				...(city && { city }),
			},
		});

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error('Complete profile error:', error);
		return NextResponse.json({ error: 'Failed to save profile' }, { status: 500 });
	}
}
