import dotenv from 'dotenv';
import { chromium, request, type FullConfig } from '@playwright/test';
import fs from 'fs/promises';
import path from 'path';

type CreatedUser = {
	key: 'user1' | 'user2';
	id: string;
	name: string;
	email: string;
	password: string;
};

async function getTestOtp(baseURL: string, email: string): Promise<string> {
	const secret = process.env.TEST_CLEANUP_SECRET;
	if (!secret) throw new Error('TEST_CLEANUP_SECRET is required for OTP retrieval');

	// Poll for up to 10s since the OTP is written async during signup
	for (let i = 0; i < 10; i++) {
		const res = await fetch(`${baseURL}/api/test/get-otp?email=${encodeURIComponent(email)}`, {
			headers: { 'x-test-secret': secret },
		});
		if (res.ok) {
			const data = (await res.json()) as { otp: string };
			return data.otp;
		}
		await new Promise(r => setTimeout(r, 1000));
	}
	throw new Error(`Failed to retrieve OTP for ${email} after 10s`);
}

export default async function globalSetup(config: FullConfig) {
	// Mirror Next.js env loading so this process sees DATABASE_URL when only .env.local defines it.
	dotenv.config({ path: path.join(process.cwd(), '.env') });
	dotenv.config({ path: path.join(process.cwd(), '.env.local'), override: true });

	if (!process.env.DATABASE_URL?.trim()) {
		throw new Error(
			'E2E global setup requires DATABASE_URL (Prisma). ' +
				'Locally: ensure .env / .env.local defines DATABASE_URL. ' +
				'GitHub Actions: set repository secrets TEST_DATABASE_URL and TEST_DIRECT_URL (CI maps them to DATABASE_URL / DIRECT_URL). ' +
				'This is not an email/SMS issue — signup hits the DB before any mail is sent.',
		);
	}

	const baseURL = (config.projects[0]?.use?.baseURL as string) || 'http://localhost:3003';
	const authDir = path.join(process.cwd(), '.playwright', 'auth');
	const usersPath = path.join(authDir, 'users.json');
	const storagePaths = {
		user1: path.join(authDir, 'user1.json'),
		user2: path.join(authDir, 'user2.json'),
	};

	await fs.mkdir(authDir, { recursive: true });

	const timestamp = Date.now();
	const rawUsers: Array<Omit<CreatedUser, 'id'>> = [
		{
			key: 'user1',
			name: `E2E User One ${timestamp}`,
			email: `e2e+${timestamp}-1@example.com`,
			password: 'Password123!',
		},
		{
			key: 'user2',
			name: `E2E User Two ${timestamp}`,
			email: `e2e+${timestamp}-2@example.com`,
			password: 'Password123!',
		},
	];

	const api = await request.newContext({ baseURL });
	const createdUsers: CreatedUser[] = [];

	for (const user of rawUsers) {
		const response = await api.post('/api/auth/signup', {
			data: {
				name: user.name,
				email: user.email,
				password: user.password,
				// Real email signup collects date of birth (required), which marks the
				// profile complete. Without it the profile-completion gate would redirect
				// these test users to /complete-profile and block every authenticated route.
				dateOfBirth: '1990-01-01',
			},
		});

		if (!response.ok()) {
			throw new Error(`Failed to create test user ${user.email}: ${response.status()} ${response.statusText()}`);
		}

		const data = (await response.json()) as { user: { id: string } };

		// Retrieve OTP from the test endpoint and verify the email
		const otp = await getTestOtp(baseURL, user.email);
		const verifyResponse = await api.post('/api/auth/verify-otp', {
			data: { email: user.email, code: otp, purpose: 'email_verification' },
		});
		if (!verifyResponse.ok()) {
			throw new Error(`Failed to verify OTP for ${user.email}: ${verifyResponse.status()}`);
		}

		createdUsers.push({ ...user, id: data.user.id });
	}

	// Get session tokens programmatically — avoids router.push race conditions in production builds.
	const secret = process.env.TEST_CLEANUP_SECRET!;
	const sessionTokens: Record<string, { token: string; cookieName: string }> = {};
	for (const user of createdUsers) {
		const sessionRes = await api.post('/api/test/create-session', {
			data: { email: user.email },
			headers: { 'x-test-secret': secret },
		});
		if (!sessionRes.ok()) {
			throw new Error(`Failed to create test session for ${user.email}: ${sessionRes.status()}`);
		}
		const data = (await sessionRes.json()) as { token: string; cookieName: string };
		sessionTokens[user.key] = data;
	}

	await api.dispose();

	const browser = await chromium.launch();
	for (const user of createdUsers) {
		const { token, cookieName } = sessionTokens[user.key];
		const context = await browser.newContext();
		await context.addCookies([
			{
				name: cookieName,
				value: token,
				url: baseURL,
				httpOnly: true,
				secure: false,
				sameSite: 'Lax',
			},
		]);
		const page = await context.newPage();
		await page.goto(`${baseURL}/home`);
		await page.waitForURL('**/home', { timeout: 15000 });
		await context.storageState({ path: storagePaths[user.key] });
		await context.close();
	}
	await browser.close();

	await fs.writeFile(
		usersPath,
		JSON.stringify(
			{
				baseURL,
				users: createdUsers,
			},
			null,
			2,
		),
	);
}
