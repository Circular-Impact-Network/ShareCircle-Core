import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('next-auth', () => ({
	getServerSession: vi.fn(),
}));

import { getServerSession } from 'next-auth';
import { POST } from '@/app/api/auth/resend-otp/route';

describe('resend-otp phone_update', () => {
	beforeEach(() => {
		vi.mocked(getServerSession).mockReset();
	});

	it('returns 401 when not authenticated', async () => {
		vi.mocked(getServerSession).mockResolvedValue(null);

		const req = new NextRequest('http://localhost/api/auth/resend-otp', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				phoneNumber: '9876543210',
				country: 'IN',
				purpose: 'phone_update',
			}),
		});

		const res = await POST(req);
		expect(res.status).toBe(401);
		const data = (await res.json()) as { error?: string };
		expect(data.error).toBe('Unauthorized');
	});
});
