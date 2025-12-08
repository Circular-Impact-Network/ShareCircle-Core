import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const { name, email, password, phoneNumber, countryCode } = body;

		// Validation
		if (!name || (!email && !phoneNumber) || !password) {
			return NextResponse.json(
				{ error: 'Name, password, and either email or phone number are required' },
				{ status: 400 },
			);
		}

		// Validate email format if provided
		if (email) {
			const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
			if (!emailRegex.test(email)) {
				return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
			}
		}

		// Validate password strength (minimum 6 characters)
		if (password.length < 6) {
			return NextResponse.json({ error: 'Password must be at least 6 characters long' }, { status: 400 });
		}

		// Check if user already exists
		if (email) {
			const existingUser = await prisma.user.findUnique({
				where: { email },
			});

			if (existingUser) {
				return NextResponse.json({ error: 'User with this email already exists' }, { status: 409 });
			}
		}

		if (phoneNumber) {
			// Note: phone_number is not unique in schema currently, but we should check
			const existingUserByPhone = await prisma.user.findFirst({
				where: { phone_number: phoneNumber },
			});

			if (existingUserByPhone) {
				return NextResponse.json({ error: 'User with this phone number already exists' }, { status: 409 });
			}
		}

		// Hash password
		const hashedPassword = await bcrypt.hash(password, 12);

		// Create user
		const user = await prisma.user.create({
			data: {
				name,
				email: email || `${phoneNumber}@phone.sharecircle.com`,
				hashed_password: hashedPassword,
				phone_number: phoneNumber,
				country_code: countryCode,
			},
			select: {
				id: true,
				name: true,
				email: true,
				created_at: true,
			},
		});

		return NextResponse.json(
			{
				message: 'User created successfully',
				user,
			},
			{ status: 201 },
		);
	} catch (error) {
		console.error('Signup error:', error);
		return NextResponse.json({ error: 'An error occurred during signup' }, { status: 500 });
	}
}
