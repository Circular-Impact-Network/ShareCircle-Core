import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { NextAuthOptions } from 'next-auth';
import { compare } from 'bcryptjs';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { prisma } from './prisma';
import { getOtpIdentifier, hashOtp, normalizeEmail, timingSafeEqualHex } from './otp';
import { isSupportedPhoneCountry, validatePhoneByCountry } from './phone';

/**
 * Bump whenever the definition of "complete profile" below changes.
 *
 * `profileComplete` is cached in the JWT and was only refreshed when absent, so widening the
 * rule would not have applied to anyone already holding a token: an existing user with a date
 * of birth but no location would keep sailing past the gate until their next sign-in. The
 * version stamp forces exactly one re-read per outstanding token.
 *
 * 2 — date of birth AND location (city), since both are mandatory at signup.
 */
const PROFILE_RULE_VERSION = 2;

/**
 * A profile is complete once both mandatory fields are captured. Location counts only when
 * it resolved to a city — latitude/longitude alone are not usable for matching people to
 * circles nearby, and the IP fallback can return coordinates with no place name.
 */
function isProfileComplete(user: { date_of_birth: Date | null; city: string | null }): boolean {
	return user.date_of_birth != null && (user.city?.trim() ?? '') !== '';
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
			// Link Google to an existing same-email account instead of failing with
			// OAuthAccountNotLinked. Safe here because Google verifies email ownership.
			allowDangerousEmailAccountLinking: true,
			// Persist Google's verified-email status at creation so first-time Google users
			// aren't bounced into an email-OTP screen they can't complete.
			profile(profile) {
				return {
					id: profile.sub,
					name: profile.name,
					email: profile.email,
					image: profile.picture,
					emailVerified: profile.email_verified ? new Date() : null,
				};
			},
		}),
		CredentialsProvider({
			name: 'Credentials',
			credentials: {
				email: { label: 'Email', type: 'email' },
				password: { label: 'Password', type: 'password' },
				phone: { label: 'Phone', type: 'text' },
				country: { label: 'Country', type: 'text' },
				code: { label: 'Code', type: 'text' }, // For OTP if we implement it later
			},
			async authorize(credentials) {
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
					const matches = timingSafeEqualHex(verificationToken.token, expected);
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
						email: user.email || undefined,
						name: user.name,
						image: user.image,
					};
				}

				// Email/Password login
				if (credentials?.email && credentials?.password) {
					const normalizedEmail = normalizeEmail(credentials.email);
					// One DB attempt is enough — the Supabase pooler handles retries upstream.
					// The previous 3-attempt loop introduced up to 450ms of synchronous sleep
					// in the login hot path under transient failures.
					const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

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
						email: user.email || undefined,
						name: user.name,
						image: user.image,
					};
				}

				// Phone + OTP login
				if (credentials?.phone && credentials?.code) {
					const normalizedCountry = credentials.country?.toUpperCase() || '';
					if (!normalizedCountry || !isSupportedPhoneCountry(normalizedCountry)) {
						throw new Error('Please select a supported country.');
					}

					const validated = validatePhoneByCountry(credentials.phone, normalizedCountry);
					if (!validated.valid || !validated.normalized) {
						throw new Error(validated.error || 'Please enter a valid phone number.');
					}

					const phoneE164 = validated.normalized.e164;
					const loginOtpIdentifier = getOtpIdentifier(phoneE164, 'phone_login');
					const signupOtpIdentifier = getOtpIdentifier(phoneE164, 'phone_signup');
					let otpIdentifier = loginOtpIdentifier;
					let otpPurpose: 'phone_login' | 'phone_signup' = 'phone_login';
					let verificationToken = await prisma.verificationToken.findFirst({
						where: { identifier: loginOtpIdentifier },
					});
					if (!verificationToken) {
						verificationToken = await prisma.verificationToken.findFirst({
							where: { identifier: signupOtpIdentifier },
						});
						if (verificationToken) {
							otpIdentifier = signupOtpIdentifier;
							otpPurpose = 'phone_signup';
						}
					}

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

					const expected = hashOtp(credentials.code, phoneE164, otpPurpose);
					const matches =
						verificationToken.token.length <= 8
							? verificationToken.token === credentials.code
							: timingSafeEqualHex(verificationToken.token, expected);
					if (!matches) {
						throw new Error('Invalid code. Please try again.');
					}

					const user = await prisma.user.findFirst({
						where: { phone_number: phoneE164 },
					});

					if (!user) {
						throw new Error('No account found for this phone number.');
					}

					if (!user.phoneVerified && otpPurpose !== 'phone_signup') {
						throw new Error('Phone number not verified. Please verify your phone number first.');
					}

					if (!user.phoneVerified && otpPurpose === 'phone_signup') {
						await prisma.user.update({
							where: { id: user.id },
							data: { phoneVerified: new Date() },
						});
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
						email: user.email || undefined,
						name: user.name,
						image: user.image,
					};
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
				session.user.profileComplete = token.profileComplete as boolean | undefined;
			}

			return session;
		},
		async jwt({ token, user, account, trigger }) {
			if (user) {
				token.id = user.id;
				token.email = user.email;
				token.name = user.name;
				token.image = user.image;
			}

			// Fetch emailVerified + profile completion from DB on sign-in, update, whenever
			// either value isn't cached in the token, or when the completeness rule has been
			// widened since this token was minted.
			if (
				trigger === 'signIn' ||
				trigger === 'update' ||
				!token.emailVerified ||
				token.emailVerifiedUnconfirmed ||
				token.profileComplete === undefined ||
				token.profileRuleVersion !== PROFILE_RULE_VERSION
			) {
				// Retry up to 3 times to handle transient Prisma Accelerate connection errors
				let dbUser: { emailVerified: Date | null; date_of_birth: Date | null; city: string | null } | null =
					null;
				for (let attempt = 0; attempt < 3; attempt++) {
					try {
						dbUser = await prisma.user.findUnique({
							where: { id: token.id as string },
							select: { emailVerified: true, date_of_birth: true, city: true },
						});
						break;
					} catch (err) {
						if (attempt === 2) {
							console.error('JWT callback: failed to fetch user after retries:', err);
						} else {
							await new Promise(r => setTimeout(r, 150 * (attempt + 1)));
						}
					}
				}
				if (dbUser !== null) {
					// A Google sign-in whose account row predates the profile() emailVerified fix
					// may still be null — heal it here so the user isn't sent to email verification.
					if (account?.provider === 'google' && !dbUser.emailVerified) {
						const verifiedAt = new Date();
						await prisma.user
							.update({ where: { id: token.id as string }, data: { emailVerified: verifiedAt } })
							.catch(err => console.error('JWT callback: failed to heal Google emailVerified:', err));
						dbUser.emailVerified = verifiedAt;
					}
					token.emailVerified = dbUser.emailVerified;
					token.profileComplete = isProfileComplete(dbUser);
					token.profileRuleVersion = PROFILE_RULE_VERSION;
					delete token.emailVerifiedUnconfirmed;
				} else if (trigger === 'signIn') {
					// authorize() already verified email — don't null it out if DB is transiently
					// unreachable, or a legitimate user gets bounced to verification over a blip.
					// Flag it so the next token refresh re-reads from the DB instead of trusting
					// this assumed value for the whole session.
					token.emailVerified = (token.emailVerified as Date | null) ?? new Date();
					token.emailVerifiedUnconfirmed = true;
				}
				// else: leave cached values unchanged (don't null out on transient DB errors)
			}

			return token;
		},
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		async signIn({ user, account, profile }) {
			// Allow all sign-ins for Google OAuth and credentials
			if (account?.provider === 'google') {
				// The PrismaAdapter will handle user creation automatically.
				// Only write emailVerified for users who don't already have it — skips a no-op write per login.
				if (user?.email) {
					await prisma.user.updateMany({
						where: { email: user.email, emailVerified: null },
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
