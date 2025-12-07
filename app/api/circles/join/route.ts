import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { JoinType, MemberRole } from '@prisma/client'

// POST /api/circles/join - Join a circle via code or link
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userId = session.user.id
    const body = await req.json()
    const { code, joinType } = body

    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { error: 'Invite code is required' },
        { status: 400 }
      )
    }

    // Normalize the code to uppercase
    const normalizedCode = code.trim().toUpperCase()

    // Find circle by invite code
    const circle = await prisma.circle.findUnique({
      where: { inviteCode: normalizedCode },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    })

    if (!circle) {
      return NextResponse.json(
        { error: 'Invalid invite code. Circle not found.' },
        { status: 404 }
      )
    }

    // Check if user is already a member
    const existingMembership = await prisma.circleMember.findUnique({
      where: {
        circleId_userId: {
          circleId: circle.id,
          userId: userId,
        },
      },
    })

    if (existingMembership) {
      if (existingMembership.leftAt) {
        // User was a member before but left - rejoin
        await prisma.circleMember.update({
          where: { id: existingMembership.id },
          data: {
            leftAt: null,
            joinType: joinType === 'LINK' ? JoinType.LINK : JoinType.CODE,
            joinedAt: new Date(),
          },
        })
      } else {
        return NextResponse.json(
          { error: 'You are already a member of this circle' },
          { status: 400 }
        )
      }
    } else {
      // Add user as new member
      await prisma.circleMember.create({
        data: {
          circleId: circle.id,
          userId: userId,
          role: MemberRole.MEMBER,
          joinType: joinType === 'LINK' ? JoinType.LINK : JoinType.CODE,
        },
      })
    }

    // Get updated member count
    const membersCount = await prisma.circleMember.count({
      where: {
        circleId: circle.id,
        leftAt: null,
      },
    })

    return NextResponse.json({
      id: circle.id,
      name: circle.name,
      description: circle.description,
      inviteCode: circle.inviteCode,
      createdAt: circle.createdAt,
      createdBy: circle.createdBy,
      membersCount,
      userRole: MemberRole.MEMBER,
      message: existingMembership?.leftAt 
        ? 'Rejoined circle successfully' 
        : 'Joined circle successfully',
    }, { status: 200 })
  } catch (error) {
    console.error('Join circle error:', error)
    return NextResponse.json(
      { error: 'Failed to join circle' },
      { status: 500 }
    )
  }
}

