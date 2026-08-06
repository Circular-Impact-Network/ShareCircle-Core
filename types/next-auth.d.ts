import 'next-auth';

declare module 'next-auth' {
	interface Session {
		user: {
			id: string;
			name?: string | null;
			email?: string | null;
			image?: string | null;
			emailVerified?: Date | null;
			profileComplete?: boolean;
		};
	}
}

declare module 'next-auth/jwt' {
	interface JWT {
		id: string;
		name?: string | null;
		email?: string | null;
		image?: string | null;
		emailVerified?: Date | null;
		profileComplete?: boolean;
		/**
		 * Set when emailVerified was assumed (not read from the DB) because the DB was
		 * transiently unreachable during sign-in. Forces a re-read on the next token refresh
		 * so an assumed value is never trusted for the life of the session.
		 */
		emailVerifiedUnconfirmed?: boolean;
		/**
		 * Which version of the "complete profile" rule produced `profileComplete`. A mismatch
		 * against PROFILE_RULE_VERSION in lib/auth.ts forces a re-read, so widening the rule
		 * takes effect for tokens minted under the old one.
		 */
		profileRuleVersion?: number;
	}
}
