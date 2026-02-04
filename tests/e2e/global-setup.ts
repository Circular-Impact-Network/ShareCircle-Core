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

export default async function globalSetup(config: FullConfig) {
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
			},
		});

		if (!response.ok()) {
			throw new Error(`Failed to create test user ${user.email}: ${response.status()} ${response.statusText()}`);
		}

		const data = (await response.json()) as { user: { id: string } };
		createdUsers.push({ ...user, id: data.user.id });
	}

	await api.dispose();

	const browser = await chromium.launch();
	for (const user of createdUsers) {
		const context = await browser.newContext();
		const page = await context.newPage();
		await page.goto(`${baseURL}/login`);
		await page.getByLabel('Email').fill(user.email);
		await page.getByLabel('Password').fill(user.password);
		await page.getByRole('button', { name: 'Login' }).click();
		await page.waitForURL('**/home');
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
