import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

/**
 * Middleware to handle authentication redirects server-side
 * This prevents the flash before redirect for unauthenticated users
 * accessing protected routes like shareable item links
 */
export async function middleware(request: NextRequest) {
	const { pathname } = request.nextUrl;

	// Get the session token
	const token = await getToken({
		req: request,
		secret: process.env.NEXTAUTH_SECRET,
	});

	// Define routes that require authentication
	const protectedRoutePatterns = [
		/^\/items\/[^/]+$/, // /items/[id] - shareable item links
		/^\/home$/,
		/^\/browse$/,
		/^\/listings$/,
		/^\/circles(\/.*)?$/,
		/^\/messages(\/.*)?$/,
		/^\/activity$/,
		/^\/notifications$/,
		/^\/requests$/,
		/^\/settings$/,
		/^\/dashboard(\/.*)?$/,
	];

	// Check if current path is a protected route
	const isProtectedRoute = protectedRoutePatterns.some(pattern => pattern.test(pathname));
	const isCompleteProfile = pathname === '/complete-profile';

	// /complete-profile requires authentication
	if (isCompleteProfile && !token) {
		const loginUrl = new URL('/login', request.url);
		loginUrl.searchParams.set('callbackUrl', pathname);
		return NextResponse.redirect(loginUrl);
	}

	// If accessing a protected route without authentication, redirect to login
	if (isProtectedRoute && !token) {
		const loginUrl = new URL('/login', request.url);
		loginUrl.searchParams.set('callbackUrl', pathname);
		return NextResponse.redirect(loginUrl);
	}

	// If authenticated user tries to access auth pages, redirect to home
	if (token && (pathname === '/login' || pathname === '/signup')) {
		if (pathname === '/signup') {
			const mode = request.nextUrl.searchParams.get('mode');
			if (mode === 'verify' && token.email && !token.emailVerified) {
				return NextResponse.next();
			}
		}
		// Check for callbackUrl first
		const callbackUrl = request.nextUrl.searchParams.get('callbackUrl');
		if (callbackUrl && callbackUrl.startsWith('/')) {
			return NextResponse.redirect(new URL(callbackUrl, request.url));
		}
		return NextResponse.redirect(new URL('/home', request.url));
	}

	// Check email verification for authenticated users on protected routes
	// Note: This is a secondary check - the main check is in the layout
	if (token && isProtectedRoute) {
		// If email is not verified and user has an email (not Google OAuth with auto-verify)
		if (token.email && !token.emailVerified) {
			const verifyUrl = new URL('/signup', request.url);
			verifyUrl.searchParams.set('mode', 'verify');
			verifyUrl.searchParams.set('email', token.email as string);
			return NextResponse.redirect(verifyUrl);
		}

		// Profile completion gate: users missing required profile data (e.g. Google
		// sign-ups that skip date of birth) must complete it before using the app.
		if (token.emailVerified && token.profileComplete === false) {
			const completeUrl = new URL('/complete-profile', request.url);
			if (pathname !== '/home') completeUrl.searchParams.set('callbackUrl', pathname);
			return NextResponse.redirect(completeUrl);
		}
	}

	// If the profile is already complete, keep users out of the onboarding step
	if (token && isCompleteProfile && token.profileComplete === true) {
		const callbackUrl = request.nextUrl.searchParams.get('callbackUrl');
		if (callbackUrl && callbackUrl.startsWith('/')) {
			return NextResponse.redirect(new URL(callbackUrl, request.url));
		}
		return NextResponse.redirect(new URL('/home', request.url));
	}

	return NextResponse.next();
}

// Configure which routes the middleware runs on
export const config = {
	matcher: [
		/*
		 * Match all request paths except for:
		 * - api routes (handled separately)
		 * - _next/static (static files)
		 * - _next/image (image optimization files)
		 * - favicon.ico (browser icon)
		 * - public folder files
		 */
		'/((?!api|_next/static|_next/image|favicon.ico|.*\\..*|public).*)',
	],
};
