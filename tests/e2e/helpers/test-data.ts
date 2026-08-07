/**
 * Test data factories and helper functions for E2E tests.
 * createItemRequest uses circleIds for multi-circle item requests.
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
	/** Claimed on approval, released on confirmed return — the borrow lifecycle turns on it. */
	isAvailable?: boolean;
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

/**
 * A signup payload the API will actually accept.
 *
 * Location became mandatory on 2026-08-05: `signupSchema` requires `city`, and
 * `isProfileComplete` in lib/auth.ts requires both `city` and `date_of_birth` before the
 * middleware will let a session reach any authenticated route. Four separate specs were posting
 * signups without them — global-setup failed the whole run with a 400, while two OTP specs and
 * a rate-limit spec called `test.skip()` on the failure and quietly stopped testing anything.
 *
 * Every e2e signup goes through here so a fifth call site cannot reintroduce that.
 */
export function signupPayload(overrides: { name: string; email: string; password: string; [key: string]: unknown }) {
	return {
		dateOfBirth: '1990-01-01',
		city: 'Austin',
		state: 'Texas',
		countryName: 'United States',
		latitude: 30.2672,
		longitude: -97.7431,
		...overrides,
	};
}

// Helper class for API operations
export class TestAPI {
	constructor(private request: APIRequestContext) {}

	/**
	 * The id of the user this request context is authenticated as, cached per instance.
	 *
	 * Needed because storage keys are namespaced by owner: `uploadImage` writes
	 * `${userId}/${Date.now()}.${ext}`, and the item routes now reject any imagePath outside the
	 * caller's own prefix. A fixed literal like `e2e-test/...` is not a path any real upload could
	 * produce, so sending one made the fixture unrepresentative of production and — once the
	 * ownership check landed — a 403.
	 */
	private cachedUserId: Promise<string> | null = null;

	userId(): Promise<string> {
		if (!this.cachedUserId) {
			this.cachedUserId = this.request.get('/api/auth/session').then(async res => {
				if (!res.ok()) throw new Error(`Failed to resolve session user: ${res.status()}`);
				const session = (await res.json()) as { user?: { id?: string } };
				if (!session.user?.id) throw new Error('Session has no user id; is this context authenticated?');
				return session.user.id;
			});
		}
		return this.cachedUserId;
	}

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
		imagePath?: string;
	}): Promise<Item> {
		const response = await this.request.post('/api/items', {
			data: {
				name: data.name || testData.itemName(),
				description: data.description || testData.itemDescription(),
				circleIds: data.circleIds,
				categories: data.categories || [],
				tags: data.tags || [],
				// A path the caller actually owns, matching the `${userId}/…` shape uploadImage
				// produces. The object itself does not exist — signing it just yields an empty
				// URL — which is enough to create an item without a real upload.
				// No imageUrl = AI listing validation is skipped.
				imagePath: data.imagePath || `${await this.userId()}/${Date.now()}.jpg`,
			},
		});

		if (!response.ok()) {
			throw new Error(`Failed to create item: ${response.status()} ${await response.text()}`);
		}

		return response.json();
	}

	async updateItem(id: string, data: Record<string, unknown>): Promise<Item> {
		const response = await this.request.patch(`/api/items/${id}`, { data });

		if (!response.ok()) {
			throw new Error(`Failed to update item: ${response.status()} ${await response.text()}`);
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
		// API schema uses `body`, not `content`. We accept `content` as the friendlier param name
		// in tests and translate here.
		const response = await this.request.post(`/api/messages/threads/${threadId}/messages`, {
			data: { body: content },
		});

		if (!response.ok()) {
			throw new Error(`Failed to send message: ${response.status()} ${await response.text()}`);
		}

		return response.json();
	}

	async createItemRequest(data: { title: string; description?: string; circleIds: string[] }): Promise<unknown> {
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
	}): Promise<{ id: string }> {
		const response = await this.request.post('/api/borrow-requests', {
			data,
		});

		if (!response.ok()) {
			throw new Error(`Failed to create borrow request: ${response.status()}`);
		}

		const json = (await response.json()) as { borrowRequest?: { id: string } };
		return json.borrowRequest ?? (json as { id: string });
	}

	async approveBorrowRequest(id: string): Promise<unknown> {
		const response = await this.request.patch(`/api/borrow-requests/${id}`, {
			data: { action: 'approve' },
		});

		if (!response.ok()) {
			throw new Error(`Failed to approve borrow request: ${response.status()} ${await response.text()}`);
		}

		return response.json();
	}

	async cancelBorrowRequest(id: string): Promise<unknown> {
		const response = await this.request.patch(`/api/borrow-requests/${id}`, {
			data: { action: 'cancel' },
		});

		if (!response.ok()) {
			throw new Error(`Failed to cancel borrow request: ${response.status()} ${await response.text()}`);
		}

		return response.json();
	}

	async confirmHandoff(borrowRequestId: string): Promise<unknown> {
		const response = await this.request.post(`/api/borrow-requests/${borrowRequestId}/handoff`);

		if (!response.ok()) {
			throw new Error(`Failed to confirm handoff: ${response.status()} ${await response.text()}`);
		}

		return response.json();
	}

	async confirmReceipt(borrowRequestId: string): Promise<unknown> {
		const response = await this.request.post(`/api/borrow-requests/${borrowRequestId}/receive`);

		if (!response.ok()) {
			throw new Error(`Failed to confirm receipt: ${response.status()} ${await response.text()}`);
		}

		return response.json();
	}

	async markReturn(borrowRequestId: string, returnNote?: string): Promise<unknown> {
		const response = await this.request.post(`/api/borrow-requests/${borrowRequestId}/return`, {
			data: { returnNote: returnNote ?? null },
		});

		if (!response.ok()) {
			throw new Error(`Failed to mark return: ${response.status()} ${await response.text()}`);
		}

		return response.json();
	}

	async confirmReturn(borrowRequestId: string): Promise<unknown> {
		const response = await this.request.post(`/api/borrow-requests/${borrowRequestId}/confirm-return`);

		if (!response.ok()) {
			throw new Error(`Failed to confirm return: ${response.status()} ${await response.text()}`);
		}

		return response.json();
	}
}

// Image buffer for testing uploads
export function createTestImageBuffer(): Buffer {
	// 1x1 transparent PNG
	return Buffer.from(
		'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
		'base64',
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
