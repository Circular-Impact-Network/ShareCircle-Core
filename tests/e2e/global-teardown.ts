import { request } from '@playwright/test';
import fs from 'fs/promises';
import path from 'path';

type UsersFile = {
	baseURL: string;
	users: Array<{ email: string }>;
};

export default async function globalTeardown() {
	const secret = process.env.TEST_CLEANUP_SECRET;
	if (!secret) {
		console.warn('TEST_CLEANUP_SECRET not set; skipping test data cleanup.');
		return;
	}

	const authDir = path.join(process.cwd(), '.playwright', 'auth');
	const usersPath = path.join(authDir, 'users.json');

	let data: UsersFile | null = null;
	try {
		const raw = await fs.readFile(usersPath, 'utf-8');
		data = JSON.parse(raw) as UsersFile;
	} catch (error) {
		console.warn('Unable to read test users file; skipping cleanup.', error);
		return;
	}

	const api = await request.newContext({ baseURL: data.baseURL });
	const response = await api.post('/api/test/cleanup', {
		data: {
			emails: data.users.map(user => user.email),
			// Also sweep test accounts abandoned by earlier runs. Deleting only this run's users
			// leaves everything behind whenever a run crashes, is cancelled, or never reaches
			// teardown, and six months of that had built up 252 users and 2,822 circles on dev —
			// enough junk data to push the slower e2e specs past their timeouts on CI.
			//
			// 6 hours is comfortably longer than the longest run and far shorter than the gap
			// between them, so a concurrent run is never affected.
			sweepOlderThanHours: 6,
		},
		headers: { 'x-test-cleanup-secret': secret },
	});

	if (!response.ok()) {
		console.warn('Test cleanup failed:', response.status(), response.statusText());
	} else {
		const body = (await response.json()) as { deleted?: number; swept?: number };
		console.log(`Test cleanup: removed ${body.deleted ?? 0} users from this run, swept ${body.swept ?? 0} stale.`);
	}

	await api.dispose();
}
