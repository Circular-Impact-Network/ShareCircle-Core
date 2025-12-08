import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { MemberRole, JoinType } from '@prisma/client';

// GET /api/circles/[id]/members - List circle members with profiles
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

		const members = await prisma.circleMember.findMany({
			where: {
				circleId: id,
				leftAt: null,
			},
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
		});

		return NextResponse.json(
			members.map(m => ({
				id: m.id,
				userId: m.user.id,
				name: m.user.name,
				email: m.user.email,
				image: m.user.image,
				role: m.role,
				joinType: m.joinType,
				joinedAt: m.joinedAt,
			})),
			{ status: 200 },
		);
	} catch (error) {
		console.error('Get members error:', error);
		return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 });
	}
}

// POST /api/circles/[id]/members - Add a member by email (admin only)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	try {
		const session = await getServerSession(authOptions);

		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { id: circleId } = await params;
		const currentUserId = session.user.id;
		const body = await req.json();
		const { email }: { email: string } = body;

		if (!email || typeof email !== 'string' || !email.includes('@')) {
			return NextResponse.json({ error: 'Valid email address is required' }, { status: 400 });
		}

		// Check if current user is an admin of this circle
		const currentUserMembership = await prisma.circleMember.findUnique({
			where: {
				circleId_userId: {
					circleId,
					userId: currentUserId,
				},
			},
		});

		if (!currentUserMembership || currentUserMembership.leftAt || currentUserMembership.role !== MemberRole.ADMIN) {
			return NextResponse.json({ error: 'Only admins can add members' }, { status: 403 });
		}

		// Find the user by email
		const userToAdd = await prisma.user.findUnique({
			where: { email: email.toLowerCase().trim() },
			select: {
				id: true,
				name: true,
				email: true,
				image: true,
			},
		});

		if (!userToAdd) {
			return NextResponse.json({ error: 'No user found with this email address' }, { status: 404 });
		}

		// Check if user is already a member
		const existingMembership = await prisma.circleMember.findUnique({
			where: {
				circleId_userId: {
					circleId,
					userId: userToAdd.id,
				},
			},
		});

		if (existingMembership) {
			if (existingMembership.leftAt) {
				// Re-activate the membership
				const updatedMember = await prisma.circleMember.update({
					where: { id: existingMembership.id },
					data: {
						leftAt: null,
						joinedAt: new Date(),
						joinType: JoinType.LINK, // Invited by admin
					},
					include: {
						user: {
							select: {
								id: true,
								name: true,
								email: true,
								image: true,
							},
						},
					},
				});

				return NextResponse.json(
					{
						id: updatedMember.id,
						userId: updatedMember.user.id,
						name: updatedMember.user.name,
						email: updatedMember.user.email,
						image: updatedMember.user.image,
						role: updatedMember.role,
						joinType: updatedMember.joinType,
						joinedAt: updatedMember.joinedAt,
						message: 'Member re-added successfully',
					},
					{ status: 200 },
				);
			} else {
				return NextResponse.json({ error: 'User is already a member of this circle' }, { status: 400 });
			}
		}

		// Add new member
		const newMember = await prisma.circleMember.create({
			data: {
				circleId,
				userId: userToAdd.id,
				role: MemberRole.MEMBER,
				joinType: JoinType.LINK, // Invited by admin
			},
			include: {
				user: {
					select: {
						id: true,
						name: true,
						email: true,
						image: true,
					},
				},
			},
		});

		return NextResponse.json(
			{
				id: newMember.id,
				userId: newMember.user.id,
				name: newMember.user.name,
				email: newMember.user.email,
				image: newMember.user.image,
				role: newMember.role,
				joinType: newMember.joinType,
				joinedAt: newMember.joinedAt,
				message: 'Member added successfully',
			},
			{ status: 201 },
		);
	} catch (error) {
		console.error('Add member error:', error);
		return NextResponse.json({ error: 'Failed to add member' }, { status: 500 });
	}
}
