import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { JoinType, MemberRole } from '@prisma/client';
import { getSignedUrl } from '@/lib/supabase';

// Generate 8-character alphanumeric invite code
function generateInviteCode(): string {
	const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluding similar characters like 0/O, 1/I/L
	let code = '';
	for (let i = 0; i < 8; i++) {
		code += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return code;
}

// GET /api/circles - List user's circles with member count
export async function GET(req: NextRequest) {
	try {
		const session = await getServerSession(authOptions);

		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const userId = session.user.id;

		// Get all circles where user is an active member
		const circles = await prisma.circle.findMany({
			where: {
				members: {
					some: {
						userId: userId,
						leftAt: null, // Only active memberships
					},
				},
			},
			include: {
				createdBy: {
					select: {
						id: true,
						name: true,
						image: true,
					},
				},
				members: {
					where: {
						leftAt: null, // Only count active members
					},
					select: {
						id: true,
						userId: true,
						role: true,
						user: {
							select: {
								id: true,
								name: true,
								image: true,
							},
						},
					},
				},
				_count: {
					select: {
						members: {
							where: {
								leftAt: null,
							},
						},
					},
				},
			},
			orderBy: {
				createdAt: 'desc',
			},
		});

		// Transform the response to include user's role in each circle
		// Generate signed URLs for avatars
		const circlesWithRole = await Promise.all(
			circles.map(async circle => {
				const userMembership = circle.members.find(m => m.userId === userId);

				// Generate signed URL from path if available
				let avatarUrl = circle.avatarUrl;
				if (circle.avatarPath) {
					try {
						avatarUrl = await getSignedUrl(circle.avatarPath, 'avatars');
					} catch (error) {
						console.error('Failed to generate avatar signed URL:', error);
					}
				}

				return {
					id: circle.id,
					name: circle.name,
					description: circle.description,
					inviteCode: circle.inviteCode,
					avatarUrl,
					createdAt: circle.createdAt,
					updatedAt: circle.updatedAt,
					createdBy: circle.createdBy,
					membersCount: circle._count.members,
					userRole: userMembership?.role || null,
					// Include first 5 member avatars for preview
					memberPreviews: circle.members.slice(0, 5).map(m => ({
						id: m.user.id,
						name: m.user.name,
						image: m.user.image,
					})),
				};
			}),
		);

		return NextResponse.json(circlesWithRole, { status: 200 });
	} catch (error) {
		console.error('Get circles error:', error);
		return NextResponse.json({ error: 'Failed to fetch circles' }, { status: 500 });
	}
}

// POST /api/circles - Create a new circle
export async function POST(req: NextRequest) {
	try {
		const session = await getServerSession(authOptions);

		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const userId = session.user.id;
		const body = await req.json();
		const { name, description } = body;

		if (!name || typeof name !== 'string' || name.trim().length === 0) {
			return NextResponse.json({ error: 'Circle name is required' }, { status: 400 });
		}

		if (name.trim().length > 100) {
			return NextResponse.json({ error: 'Circle name must be less than 100 characters' }, { status: 400 });
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

		// Create circle and add creator as ADMIN member in a transaction
		const circle = await prisma.$transaction(async tx => {
			const newCircle = await tx.circle.create({
				data: {
					name: name.trim(),
					description: description?.trim() || null,
					inviteCode,
					createdById: userId,
				},
			});

			// Add creator as ADMIN member
			await tx.circleMember.create({
				data: {
					circleId: newCircle.id,
					userId: userId,
					role: MemberRole.ADMIN,
					joinType: JoinType.CREATED,
				},
			});

			return newCircle;
		});

		// Fetch the complete circle data with creator info
		const createdCircle = await prisma.circle.findUnique({
			where: { id: circle.id },
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
						members: {
							where: { leftAt: null },
						},
					},
				},
			},
		});

		return NextResponse.json(
			{
				id: createdCircle!.id,
				name: createdCircle!.name,
				description: createdCircle!.description,
				inviteCode: createdCircle!.inviteCode,
				avatarUrl: createdCircle!.avatarUrl,
				createdAt: createdCircle!.createdAt,
				createdBy: createdCircle!.createdBy,
				membersCount: createdCircle!._count.members,
				userRole: MemberRole.ADMIN,
				memberPreviews: [],
			},
			{ status: 201 },
		);
	} catch (error) {
		console.error('Create circle error:', error);
		return NextResponse.json({ error: 'Failed to create circle' }, { status: 500 });
	}
}
