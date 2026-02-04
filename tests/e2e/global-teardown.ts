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
		data: { emails: data.users.map(user => user.email) },
		headers: { 'x-test-cleanup-secret': secret },
	});

	if (!response.ok()) {
		console.warn('Test cleanup failed:', response.status(), response.statusText());
	}

	await api.dispose();
}
