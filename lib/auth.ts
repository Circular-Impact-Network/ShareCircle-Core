import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { NextAuthOptions } from 'next-auth';
import { compare } from 'bcryptjs';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { prisma } from './prisma';

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

					const isPasswordValid = await compare(credentials.password, user.hashed_password);

					if (!isPasswordValid) {
						return null;
					}

					return {
						id: user.id,
						email: user.email,
						name: user.name,
						image: user.profile_media_url,
					};
				}

				// Phone login (Mock implementation for now as per plan)
				// In a real app, we would verify OTP here
				if (credentials?.phone) {
					// Check if user exists with this phone
					// Note: Since phone_number is not unique in schema (it should be ideally), findFirst is used
					// But for auth it really should be unique.
					const user = await prisma.user.findFirst({
						where: {
							phone_number: credentials.phone,
						},
					});

					if (user) {
						return {
							id: user.id,
							email: user.email,
							name: user.name,
							image: user.profile_media_url,
						};
					}
					
					// If user doesn't exist, we might want to return null or handle signup
					// For this task, we'll assume the user must exist or we return null
					return null; 
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
			}

			return session;
		},
		async jwt({ token, user }) {
			if (user) {
				token.id = user.id;
				token.email = user.email;
				token.name = user.name;
				token.image = user.image;
			}

			return token;
		},
		async signIn({ user, account, profile }) {
			// Allow all sign-ins for Google OAuth and credentials
			if (account?.provider === 'google') {
				// The PrismaAdapter will handle user creation automatically
				return true;
			}
			return true;
		},
		async redirect({ url, baseUrl }) {
			// Allows relative callback URLs
			if (url.startsWith('/')) return `${baseUrl}${url}`;
			// Allows callback URLs on the same origin
			else if (new URL(url).origin === baseUrl) return url;

			// Default redirect to dashboard after login
			return baseUrl + '/dashboard';
		},
	},
};
