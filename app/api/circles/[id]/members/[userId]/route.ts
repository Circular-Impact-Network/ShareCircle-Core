import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { MemberRole } from '@prisma/client';

// PUT /api/circles/[id]/members/[userId] - Update member role (admin only)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; userId: string }> }) {
	try {
		const session = await getServerSession(authOptions);

		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { id: circleId, userId: targetUserId } = await params;
		const currentUserId = session.user.id;
		const body = await req.json();
		const { role } = body;

		// Validate role
		if (!role || !Object.values(MemberRole).includes(role)) {
			return NextResponse.json({ error: 'Invalid role. Must be ADMIN or MEMBER' }, { status: 400 });
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
			return NextResponse.json({ error: 'Only admins can change member roles' }, { status: 403 });
		}

		// Get the target member
		const targetMembership = await prisma.circleMember.findUnique({
			where: {
				circleId_userId: {
					circleId,
					userId: targetUserId,
				},
			},
		});

		if (!targetMembership || targetMembership.leftAt) {
			return NextResponse.json({ error: 'Member not found in this circle' }, { status: 404 });
		}

		// Prevent demoting yourself if you're the only admin
		if (currentUserId === targetUserId && role === MemberRole.MEMBER) {
			const adminCount = await prisma.circleMember.count({
				where: {
					circleId,
					role: MemberRole.ADMIN,
					leftAt: null,
				},
			});

			if (adminCount <= 1) {
				return NextResponse.json(
					{ error: 'Cannot demote yourself. Circle must have at least one admin.' },
					{ status: 400 },
				);
			}
		}

		// Update member role
		const updatedMember = await prisma.circleMember.update({
			where: {
				circleId_userId: {
					circleId,
					userId: targetUserId,
				},
			},
			data: { role },
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
			},
			{ status: 200 },
		);
	} catch (error) {
		console.error('Update member role error:', error);
		return NextResponse.json({ error: 'Failed to update member role' }, { status: 500 });
	}
}

// DELETE /api/circles/[id]/members/[userId] - Remove member or leave circle
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; userId: string }> }) {
	try {
		const session = await getServerSession(authOptions);

		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { id: circleId, userId: targetUserId } = await params;
		const currentUserId = session.user.id;

		// Check if current user is a member of this circle
		const currentUserMembership = await prisma.circleMember.findUnique({
			where: {
				circleId_userId: {
					circleId,
					userId: currentUserId,
				},
			},
		});

		if (!currentUserMembership || currentUserMembership.leftAt) {
			return NextResponse.json({ error: 'You are not a member of this circle' }, { status: 403 });
		}

		const isLeavingSelf = currentUserId === targetUserId;
		const isAdmin = currentUserMembership.role === MemberRole.ADMIN;

		// If not leaving self, must be admin to remove others
		if (!isLeavingSelf && !isAdmin) {
			return NextResponse.json({ error: 'Only admins can remove other members' }, { status: 403 });
		}

		// Get the target member
		const targetMembership = await prisma.circleMember.findUnique({
			where: {
				circleId_userId: {
					circleId,
					userId: targetUserId,
				},
			},
		});

		if (!targetMembership || targetMembership.leftAt) {
			return NextResponse.json({ error: 'Member not found in this circle' }, { status: 404 });
		}

		// If leaving self and is admin, check if there are other admins
		if (isLeavingSelf && isAdmin) {
			const adminCount = await prisma.circleMember.count({
				where: {
					circleId,
					role: MemberRole.ADMIN,
					leftAt: null,
				},
			});

			if (adminCount <= 1) {
				// Check if there are other members to promote
				const otherMembers = await prisma.circleMember.findMany({
					where: {
						circleId,
						leftAt: null,
						NOT: { userId: currentUserId },
					},
					orderBy: { joinedAt: 'asc' },
					take: 1,
				});

				if (otherMembers.length > 0) {
					// Promote the earliest member to admin
					await prisma.circleMember.update({
						where: { id: otherMembers[0].id },
						data: { role: MemberRole.ADMIN },
					});
				}
				// If no other members, circle will be empty (or delete circle?)
			}
		}

		// Soft delete - set leftAt timestamp
		await prisma.circleMember.update({
			where: {
				circleId_userId: {
					circleId,
					userId: targetUserId,
				},
			},
			data: { leftAt: new Date() },
		});

		return NextResponse.json(
			{ message: isLeavingSelf ? 'Left circle successfully' : 'Member removed successfully' },
			{ status: 200 },
		);
	} catch (error) {
		console.error('Remove member error:', error);
		return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 });
	}
}
