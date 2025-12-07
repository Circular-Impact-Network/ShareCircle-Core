import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/circles/[id]/members - List circle members with profiles
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = await params
    const userId = session.user.id

    // Check if user is a member of this circle
    const membership = await prisma.circleMember.findUnique({
      where: {
        circleId_userId: {
          circleId: id,
          userId: userId,
        },
      },
    })

    if (!membership || membership.leftAt) {
      return NextResponse.json(
        { error: 'You are not a member of this circle' },
        { status: 403 }
      )
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
    })

    return NextResponse.json(
      members.map((m) => ({
        id: m.id,
        userId: m.user.id,
        name: m.user.name,
        email: m.user.email,
        image: m.user.image,
        role: m.role,
        joinType: m.joinType,
        joinedAt: m.joinedAt,
      })),
      { status: 200 }
    )
  } catch (error) {
    console.error('Get members error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch members' },
      { status: 500 }
    )
  }
}

