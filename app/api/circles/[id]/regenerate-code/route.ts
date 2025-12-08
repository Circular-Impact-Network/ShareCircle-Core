import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { MemberRole } from '@prisma/client';

// Generate 8-character alphanumeric invite code
function generateInviteCode(): string {
	const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
	let code = '';
	for (let i = 0; i < 8; i++) {
		code += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return code;
}

// POST /api/circles/[id]/regenerate-code - Generate new invite code (admin only)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	try {
		const session = await getServerSession(authOptions);

		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { id } = await params;
		const userId = session.user.id;

		// Check if user is an admin of this circle
		const membership = await prisma.circleMember.findUnique({
			where: {
				circleId_userId: {
					circleId: id,
					userId: userId,
				},
			},
		});

		if (!membership || membership.leftAt || membership.role !== MemberRole.ADMIN) {
			return NextResponse.json({ error: 'Only admins can regenerate invite codes' }, { status: 403 });
		}

		// Generate unique invite code
		let inviteCode = generateInviteCode();
		let codeExists = true;
		let attempts = 0;
		const maxAttempts = 10;

		while (codeExists && attempts < maxAttempts) {
			const existing = await prisma.circle.findUnique({
				where: { inviteCode },
			});
			if (!existing) {
				codeExists = false;
			} else {
				inviteCode = generateInviteCode();
				attempts++;
			}
		}

		if (attempts >= maxAttempts) {
			return NextResponse.json(
				{ error: 'Failed to generate unique invite code. Please try again.' },
				{ status: 500 },
			);
		}

		const updatedCircle = await prisma.circle.update({
			where: { id },
			data: { inviteCode },
		});

		return NextResponse.json({ inviteCode: updatedCircle.inviteCode }, { status: 200 });
	} catch (error) {
		console.error('Regenerate code error:', error);
		return NextResponse.json({ error: 'Failed to regenerate invite code' }, { status: 500 });
	}
}
