import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { AddItemModal } from '@/components/modals/add-item-modal';

const uploadImageMock = vi.fn(() => ({
	unwrap: () => Promise.resolve({ path: 'uploads/item.png', url: 'https://example.com/item.png' }),
}));
const uploadMediaMock = vi.fn(() => ({
	unwrap: () => Promise.resolve({ path: 'uploads/media.png', url: 'https://example.com/media.png' }),
}));
const detectItemsMock = vi.fn(() => ({
	unwrap: () => Promise.resolve({ items: [{ name: 'Camping Tent' }] }),
}));
const analyzeImageMock = vi.fn(() => ({
	unwrap: () =>
		Promise.resolve({
			name: 'Camping Tent',
			description: 'A reliable tent.',
			categories: ['Outdoors'],
			tags: ['camping'],
		}),
}));
const createItemMock = vi.fn(() => ({
	unwrap: () => Promise.resolve({}),
}));
const cleanupImageMock = vi.fn(() => ({
	unwrap: () => Promise.resolve({}),
}));

vi.mock('@/lib/redux/api/itemsApi', () => ({
	useUploadItemImageMutation: () => [uploadImageMock],
	useUploadMediaMutation: () => [uploadMediaMock],
	useDetectItemsMutation: () => [detectItemsMock],
	useAnalyzeImageMutation: () => [analyzeImageMock, { isLoading: false }],
	useCreateItemMutation: () => [createItemMock, { isLoading: false }],
	useCleanupImageMutation: () => [cleanupImageMock],
}));

vi.mock('@/hooks/use-toast', () => ({
	useToast: () => ({ toast: vi.fn() }),
}));

describe('AddItemModal', () => {
	it('renders add item modal heading', () => {
		const fetchSpy = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => [{ id: 'circle-1', name: 'Test Circle' }],
		});
		vi.stubGlobal('fetch', fetchSpy);

		render(<AddItemModal open onOpenChange={() => undefined} />);

		// Modal should render with heading
		expect(screen.getByRole('heading', { name: /Add Item|New Item/i })).toBeInTheDocument();
	});

	// Note: The full detection and creation flow is tested via E2E tests
	// (tests/e2e/circles-items.spec.ts) because file upload interactions
	// with happy-dom have compatibility issues with userEvent.upload()
});
