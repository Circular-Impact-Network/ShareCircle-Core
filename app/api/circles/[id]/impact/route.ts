import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { MemberRole } from '@prisma/client';
import { getCircleImpact, getCircleMemberBreakdown } from '@/lib/impact';

// GET /api/circles/[id]/impact - circle impact summary (members) + per-member breakdown (admins only)
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
	try {
		const session = await getServerSession(authOptions);
		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { id: circleId } = await params;

		// Circle membership gate — only active members can see a circle's impact.
		const membership = await prisma.circleMember.findFirst({
			where: { circleId, userId: session.user.id, leftAt: null },
		});
		if (!membership) {
			return NextResponse.json({ error: 'Not a member of this circle' }, { status: 403 });
		}

		const isAdmin = membership.role === MemberRole.ADMIN;
		const [summary, members] = await Promise.all([
			getCircleImpact(circleId),
			isAdmin ? getCircleMemberBreakdown(circleId) : Promise.resolve([]),
		]);

		return NextResponse.json({ summary, members, isAdmin }, { status: 200 });
	} catch (error) {
		console.error('Get circle impact error:', error);
		return NextResponse.json({ error: 'Failed to load circle impact' }, { status: 500 });
	}
}
