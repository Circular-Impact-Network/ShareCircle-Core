import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { MemberRole } from '@prisma/client';

// GET /api/circles/[id] - Get circle details with members
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	try {
		const session = await getServerSession(authOptions);

		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { id } = await params;
		const userId = session.user.id;

		// Check if user is a member of this circle
		const membership = await prisma.circleMember.findUnique({
			where: {
				circleId_userId: {
					circleId: id,
					userId: userId,
				},
			},
		});

		if (!membership || membership.leftAt) {
			return NextResponse.json({ error: 'You are not a member of this circle' }, { status: 403 });
		}

		const circle = await prisma.circle.findUnique({
			where: { id },
			include: {
				createdBy: {
					select: {
						id: true,
						name: true,
						image: true,
						email: true,
					},
				},
				members: {
					where: { leftAt: null },
					include: {
						user: {
							select: {
								id: true,
								name: true,
								image: true,
								email: true,
							},
						},
					},
					orderBy: [
						{ role: 'asc' }, // ADMIN first
						{ joinedAt: 'asc' },
					],
				},
			},
		});

		if (!circle) {
			return NextResponse.json({ error: 'Circle not found' }, { status: 404 });
		}

		return NextResponse.json(
			{
				id: circle.id,
				name: circle.name,
				description: circle.description,
				inviteCode: circle.inviteCode,
				avatarUrl: circle.avatarUrl,
				createdAt: circle.createdAt,
				updatedAt: circle.updatedAt,
				createdBy: circle.createdBy,
				membersCount: circle.members.length,
				userRole: membership.role,
				members: circle.members.map(m => ({
					id: m.id,
					userId: m.user.id,
					name: m.user.name,
					email: m.user.email,
					image: m.user.image,
					role: m.role,
					joinType: m.joinType,
					joinedAt: m.joinedAt,
				})),
			},
			{ status: 200 },
		);
	} catch (error) {
		console.error('Get circle error:', error);
		return NextResponse.json({ error: 'Failed to fetch circle' }, { status: 500 });
	}
}

// PUT /api/circles/[id] - Update circle (admin only)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	try {
		const session = await getServerSession(authOptions);

		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { id } = await params;
		const userId = session.user.id;
		const body = await req.json();
		const { name, description, avatarUrl } = body;

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
			return NextResponse.json({ error: 'Only admins can update circle details' }, { status: 403 });
		}

		// Validate input
		if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
			return NextResponse.json({ error: 'Invalid circle name' }, { status: 400 });
		}

		if (name && name.trim().length > 100) {
			return NextResponse.json({ error: 'Circle name must be less than 100 characters' }, { status: 400 });
		}

		const updatedCircle = await prisma.circle.update({
			where: { id },
			data: {
				...(name !== undefined && { name: name.trim() }),
				...(description !== undefined && { description: description?.trim() || null }),
				...(avatarUrl !== undefined && { avatarUrl }),
			},
			include: {
				createdBy: {
					select: {
						id: true,
						name: true,
						image: true,
					},
				},
				_count: {
					select: {
						members: { where: { leftAt: null } },
					},
				},
			},
		});

		return NextResponse.json(
			{
				id: updatedCircle.id,
				name: updatedCircle.name,
				description: updatedCircle.description,
				inviteCode: updatedCircle.inviteCode,
				avatarUrl: updatedCircle.avatarUrl,
				createdAt: updatedCircle.createdAt,
				updatedAt: updatedCircle.updatedAt,
				createdBy: updatedCircle.createdBy,
				membersCount: updatedCircle._count.members,
			},
			{ status: 200 },
		);
	} catch (error) {
		console.error('Update circle error:', error);
		return NextResponse.json({ error: 'Failed to update circle' }, { status: 500 });
	}
}

// DELETE /api/circles/[id] - Delete circle (admin only)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
			return NextResponse.json({ error: 'Only admins can delete circles' }, { status: 403 });
		}

		// Delete circle (cascade will handle members)
		await prisma.circle.delete({
			where: { id },
		});

		return NextResponse.json({ message: 'Circle deleted successfully' }, { status: 200 });
	} catch (error) {
		console.error('Delete circle error:', error);
		return NextResponse.json({ error: 'Failed to delete circle' }, { status: 500 });
	}
}
