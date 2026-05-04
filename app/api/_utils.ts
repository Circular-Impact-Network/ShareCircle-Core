import { prisma } from '@/lib/prisma';

export async function getUserCircleIds(userId: string): Promise<string[]> {
	const memberships = await prisma.circleMember.findMany({
		where: { userId, leftAt: null },
		select: { circleId: true },
	});
	return memberships.map(m => m.circleId);
}
