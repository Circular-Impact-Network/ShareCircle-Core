import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PATCH(req: NextRequest) {
	try {
		const session = await getServerSession(authOptions);

		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const body = await req.json();
		const { name, bio, image, phoneNumber, countryCode } = body;

		// Update user profile
		const updatedUser = await prisma.user.update({
			where: { id: session.user.id },
			data: {
				...(name !== undefined && { name }),
				...(image !== undefined && { image }),
				...(phoneNumber !== undefined && { phone_number: phoneNumber }),
				...(countryCode !== undefined && { country_code: countryCode }),
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
