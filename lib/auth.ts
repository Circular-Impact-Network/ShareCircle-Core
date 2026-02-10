import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { NextAuthOptions } from 'next-auth';
import { compare } from 'bcryptjs';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { prisma } from './prisma';
import { RATE_LIMITS } from './rate-limit';
import { getOtpIdentifier, hashOtp, normalizeEmail, timingSafeEqualHex } from './otp';

// Simple in-memory rate limit check for auth (can't use request headers in authorize)
const authRateLimitStore = new Map<string, { count: number; resetTime: number }>();

function checkAuthRateLimit(identifier: string): { allowed: boolean; retryAfter?: number } {
	const now = Date.now();
	const windowMs = RATE_LIMITS.auth.windowSeconds * 1000;
	const record = authRateLimitStore.get(identifier);

	if (!record || now > record.resetTime) {
		authRateLimitStore.set(identifier, { count: 1, resetTime: now + windowMs });
		return { allowed: true };
	}

	if (record.count >= RATE_LIMITS.auth.maxRequests) {
		return { allowed: false, retryAfter: Math.ceil((record.resetTime - now) / 1000) };
	}

	record.count += 1;
	return { allowed: true };
}

export const authOptions: NextAuthOptions = {
	adapter: PrismaAdapter(prisma),
	secret: process.env.NEXTAUTH_SECRET,
	session: {
		strategy: 'jwt',
	},
	pages: {
		signIn: '/login',
	},
	providers: [
		GoogleProvider({
			clientId: process.env.GOOGLE_CLIENT_ID!,
			clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
		}),
		CredentialsProvider({
			name: 'Credentials',
			credentials: {
				email: { label: 'Email', type: 'email' },
				password: { label: 'Password', type: 'password' },
				phone: { label: 'Phone', type: 'text' },
				code: { label: 'Code', type: 'text' }, // For OTP if we implement it later
			},
			async authorize(credentials) {
				// Rate limit check for login attempts
				const identifier = credentials?.email || credentials?.phone || 'unknown';
				const rateLimit = checkAuthRateLimit(`login:${identifier}`);
				if (!rateLimit.allowed) {
					throw new Error(`Too many login attempts. Please try again in ${rateLimit.retryAfter} seconds.`);
				}

				// Email + OTP login
				if (credentials?.email && credentials?.code) {
					const normalizedEmail = normalizeEmail(credentials.email);
					const otpIdentifier = getOtpIdentifier(normalizedEmail, 'login_otp');
					const verificationToken = await prisma.verificationToken.findFirst({
						where: { identifier: otpIdentifier },
					});

					if (!verificationToken) {
						throw new Error('Invalid or expired code. Please request a new one.');
					}

					if (new Date() > verificationToken.expires) {
						await prisma.verificationToken.delete({
							where: {
								identifier_token: {
									identifier: otpIdentifier,
									token: verificationToken.token,
								},
							},
						});
						throw new Error('Code expired. Please request a new one.');
					}

					const expected = hashOtp(credentials.code, normalizedEmail, 'login_otp');
					const matches =
						verificationToken.token.length <= 8
							? verificationToken.token === credentials.code
							: timingSafeEqualHex(verificationToken.token, expected);
					if (!matches) {
						throw new Error('Invalid code. Please try again.');
					}

					const user = await prisma.user.findUnique({
						where: { email: normalizedEmail },
					});

					if (!user) {
						throw new Error('No account found for this email.');
					}

					if (!user.emailVerified) {
						throw new Error('Email not verified. Please verify your email.');
					}

					await prisma.verificationToken.delete({
						where: {
							identifier_token: {
								identifier: otpIdentifier,
								token: verificationToken.token,
							},
						},
					});

					return {
						id: user.id,
						email: user.email,
						name: user.name,
						image: user.image,
					};
				}

				// Email/Password login
				if (credentials?.email && credentials?.password) {
					const user = await prisma.user.findUnique({
						where: {
							email: credentials.email,
						},
					});

					if (!user || !user.hashed_password) {
						return null;
					}

					if (!user.emailVerified) {
						throw new Error('Email not verified. Please verify your email.');
					}

					const isPasswordValid = await compare(credentials.password, user.hashed_password);

					if (!isPasswordValid) {
						return null;
					}

					return {
						id: user.id,
						email: user.email,
						name: user.name,
						image: user.image,
					};
				}

				// Phone login is DISABLED for security reasons
				// The mock implementation without OTP verification is insecure
				// To re-enable, implement proper OTP verification first
				if (credentials?.phone) {
					// Phone login disabled - requires OTP implementation
					throw new Error(
						'Phone login is temporarily disabled. Please use email/password or Google sign-in.',
					);
				}

				return null;
			},
		}),
	],
	callbacks: {
		async session({ token, session }) {
			if (token) {
				session.user.id = token.id as string;
				session.user.name = token.name;
				session.user.email = token.email;
				session.user.image = token.image as string;
				session.user.emailVerified = token.emailVerified as Date | null;
			}

			return session;
		},
		async jwt({ token, user, trigger }) {
			if (user) {
				token.id = user.id;
				token.email = user.email;
				token.name = user.name;
				token.image = user.image;
			}

			// Fetch emailVerified status from database on sign-in and update
			if (trigger === 'signIn' || trigger === 'update' || !token.emailVerified) {
				const dbUser = await prisma.user.findUnique({
					where: { id: token.id as string },
					select: { emailVerified: true },
				});
				token.emailVerified = dbUser?.emailVerified || null;
			}

			return token;
		},
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		async signIn({ user, account, profile }) {
			// Allow all sign-ins for Google OAuth and credentials
			if (account?.provider === 'google') {
				// The PrismaAdapter will handle user creation automatically
				if (user?.email) {
					await prisma.user.update({
						where: { email: user.email },
						data: { emailVerified: new Date() },
					});
				}
				return true;
			}
			return true;
		},
		async redirect({ url, baseUrl }) {
			// Allows relative callback URLs
			if (url.startsWith('/')) return `${baseUrl}${url}`;
			// Allows callback URLs on the same origin
			else if (new URL(url).origin === baseUrl) return url;

			// Default redirect to home after login
			return baseUrl + '/home';
		},
	},
};
