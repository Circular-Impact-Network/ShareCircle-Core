import { test as base, expect } from '@playwright/test';
import fs from 'fs/promises';
import path from 'path';

export type TestUser = {
	key: 'user1' | 'user2';
	id: string;
	name: string;
	email: string;
	password: string;
};

type UsersFile = {
	baseURL: string;
	users: TestUser[];
};

const authDir = path.join(process.cwd(), '.playwright', 'auth');
const usersPath = path.join(authDir, 'users.json');

export const storageStatePaths = {
	user1: path.join(authDir, 'user1.json'),
	user2: path.join(authDir, 'user2.json'),
};

export const test = base.extend<{ users: { user1: TestUser; user2: TestUser } }>({
	users: async ({}, use) => {
		const raw = await fs.readFile(usersPath, 'utf-8');
		const data = JSON.parse(raw) as UsersFile;
		const map = new Map(data.users.map(user => [user.key, user]));
		await use({
			user1: map.get('user1') as TestUser,
			user2: map.get('user2') as TestUser,
		});
	},
});

export { expect };
