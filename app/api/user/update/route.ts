import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const isSupabaseUrl = (url: string) => {
	try {
		const hostname = new URL(url).hostname;
		const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
		const supabaseHost = supabaseUrl ? new URL(supabaseUrl).hostname : '';
		return hostname.endsWith('.supabase.co') || hostname === supabaseHost;
	} catch {
		return false;
	}
};

const updateUserSchema = z.object({
	name: z.string().trim().min(1).max(100).optional(),
	image: z.string().refine(isSupabaseUrl, 'Invalid image URL').nullish(),
});

export async function PATCH(req: NextRequest) {
	try {
		const session = await getServerSession(authOptions);

		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const rawBody = await req.json();
		if (rawBody.phoneNumber !== undefined || rawBody.countryCode !== undefined) {
			return NextResponse.json(
				{ error: 'Phone number updates must be verified via OTP before saving.' },
				{ status: 400 },
			);
		}
		const parsed = updateUserSchema.safeParse(rawBody);
		if (!parsed.success) {
			return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Invalid request body' }, { status: 400 });
		}
		const { name, image } = parsed.data;

		// Update user profile
		const updatedUser = await prisma.user.update({
			where: { id: session.user.id },
			data: {
				...(name !== undefined && { name }),
				...(image !== undefined && { image }),
				// Note: bio field doesn't exist in current schema, would need to add it
			},
			select: {
				id: true,
				name: true,
				email: true,
				image: true,
				phone_number: true,
				country_code: true,
			},
		});

		// Return in format expected by RTK Query
		return NextResponse.json(
			{
				id: updatedUser.id,
				name: updatedUser.name,
				email: updatedUser.email,
				image: updatedUser.image,
				phoneNumber: updatedUser.phone_number,
				countryCode: updatedUser.country_code,
				bio: null, // Will be added when bio field is added to schema
			},
			{ status: 200 },
		);
	} catch (error) {
		console.error('Profile update error:', error);
		return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
	}
}
