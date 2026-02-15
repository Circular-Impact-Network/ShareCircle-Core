/**
 * Test data factories and helper functions for E2E tests
 */

import { APIRequestContext } from '@playwright/test';

// Types
export interface Circle {
	id: string;
	name: string;
	description: string;
	inviteCode: string;
	inviteExpiresAt: string;
}

export interface Item {
	id: string;
	name: string;
	description: string;
	imageUrl?: string;
}

export interface Thread {
	id: string;
}

export interface Message {
	id: string;
	content: string;
}

// Factory functions for generating test data
export const testData = {
	circleName: () => `E2E Circle ${Date.now()}`,
	circleDescription: () => 'Circle created for E2E testing',
	itemName: () => `E2E Item ${Date.now()}`,
	itemDescription: () => 'Item created for E2E testing',
	messageText: () => `E2E Message ${Date.now()}`,
	userName: () => `E2E User ${Date.now()}`,
	email: () => `e2e-${Date.now()}@test.local`,
};

// Helper class for API operations
export class TestAPI {
	constructor(private request: APIRequestContext) {}

	async createCircle(data?: { name?: string; description?: string }): Promise<Circle> {
		const response = await this.request.post('/api/circles', {
			data: {
				name: data?.name || testData.circleName(),
				description: data?.description || testData.circleDescription(),
			},
		});

		if (!response.ok()) {
			throw new Error(`Failed to create circle: ${response.status()}`);
		}

		return response.json();
	}

	async getCircle(id: string): Promise<Circle> {
		const response = await this.request.get(`/api/circles/${id}`);

		if (!response.ok()) {
			throw new Error(`Failed to get circle: ${response.status()}`);
		}

		return response.json();
	}

	async joinCircle(inviteCode: string): Promise<Circle> {
		const response = await this.request.post('/api/circles/join', {
			data: { code: inviteCode },
		});

		if (!response.ok()) {
			throw new Error(`Failed to join circle: ${response.status()}`);
		}

		return response.json();
	}

	async createItem(data: {
		name?: string;
		description?: string;
		circleIds: string[];
		categories?: string[];
		tags?: string[];
	}): Promise<Item> {
		const response = await this.request.post('/api/items', {
			data: {
				name: data.name || testData.itemName(),
				description: data.description || testData.itemDescription(),
				circleIds: data.circleIds,
				categories: data.categories || [],
				tags: data.tags || [],
			},
		});

		if (!response.ok()) {
			throw new Error(`Failed to create item: ${response.status()}`);
		}

		return response.json();
	}

	async getItem(id: string): Promise<Item> {
		const response = await this.request.get(`/api/items/${id}`);

		if (!response.ok()) {
			throw new Error(`Failed to get item: ${response.status()}`);
		}

		return response.json();
	}

	async deleteItem(id: string): Promise<void> {
		const response = await this.request.delete(`/api/items/${id}`);

		if (!response.ok()) {
			throw new Error(`Failed to delete item: ${response.status()}`);
		}
	}

	async createThread(otherUserId: string): Promise<Thread> {
		const response = await this.request.post('/api/messages/threads', {
			data: { otherUserId },
		});

		if (!response.ok()) {
			throw new Error(`Failed to create thread: ${response.status()}`);
		}

		return response.json();
	}

	async sendMessage(threadId: string, content: string): Promise<Message> {
		const response = await this.request.post(`/api/messages/threads/${threadId}/messages`, {
			data: { content },
		});

		if (!response.ok()) {
			throw new Error(`Failed to send message: ${response.status()}`);
		}

		return response.json();
	}

	async createItemRequest(data: { title: string; description?: string; circleId: string }): Promise<unknown> {
		const response = await this.request.post('/api/item-requests', {
			data,
		});

		if (!response.ok()) {
			throw new Error(`Failed to create item request: ${response.status()}`);
		}

		return response.json();
	}

	async createBorrowRequest(data: {
		itemId: string;
		desiredFrom: string;
		desiredTo: string;
		message?: string;
	}): Promise<unknown> {
		const response = await this.request.post('/api/borrow-requests', {
			data,
		});

		if (!response.ok()) {
			throw new Error(`Failed to create borrow request: ${response.status()}`);
		}

		return response.json();
	}
}

// Image buffer for testing uploads
export function createTestImageBuffer(): Buffer {
	// 1x1 transparent PNG
	return Buffer.from(
		'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
		'base64'
	);
}

// Date helpers
export const dateHelpers = {
	today: () => new Date().toISOString().split('T')[0],
	tomorrow: () => {
		const d = new Date();
		d.setDate(d.getDate() + 1);
		return d.toISOString().split('T')[0];
	},
	nextWeek: () => {
		const d = new Date();
		d.setDate(d.getDate() + 7);
		return d.toISOString().split('T')[0];
	},
	inDays: (days: number) => {
		const d = new Date();
		d.setDate(d.getDate() + days);
		return d.toISOString().split('T')[0];
	},
};

// Wait helpers
export const waitFor = {
	networkIdle: async (page: { waitForLoadState: (state: string) => Promise<void> }) => {
		await page.waitForLoadState('networkidle');
	},
	timeout: async (ms: number) => {
		await new Promise(resolve => setTimeout(resolve, ms));
	},
};
