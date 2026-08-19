import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * The provider wraps the entire application from the root layout, so its behaviour when the key is
 * absent is not a detail: handing the SDK an `undefined` key would take the whole app down on any
 * deploy that forgot the environment variable. Degrading to "no device intelligence" is the only
 * acceptable failure here.
 *
 * The region is asserted too. It is not cosmetic — a workspace in `us` queried against the wrong
 * region does not fall back, it simply never identifies anyone.
 */
vi.mock('@fingerprint/react', () => ({
	FingerprintProvider: ({
		apiKey,
		region,
		children,
	}: {
		apiKey: string;
		region: string;
		children: React.ReactNode;
	}) => (
		<div data-testid="fp-agent" data-api-key={apiKey} data-region={region}>
			{children}
		</div>
	),
}));

const ORIGINAL = process.env.NEXT_PUBLIC_FINGERPRINT_API_KEY;

// The key is read at module scope, so each case needs a fresh module instance.
async function renderWith(key: string | undefined) {
	if (key === undefined) {
		delete process.env.NEXT_PUBLIC_FINGERPRINT_API_KEY;
	} else {
		process.env.NEXT_PUBLIC_FINGERPRINT_API_KEY = key;
	}
	vi.resetModules();
	const { FingerprintProvider } = await import('@/components/providers/fingerprint-provider');
	return render(
		<FingerprintProvider>
			<span data-testid="app">app</span>
		</FingerprintProvider>,
	);
}

afterEach(() => {
	if (ORIGINAL === undefined) {
		delete process.env.NEXT_PUBLIC_FINGERPRINT_API_KEY;
	} else {
		process.env.NEXT_PUBLIC_FINGERPRINT_API_KEY = ORIGINAL;
	}
	vi.resetModules();
});

describe('FingerprintProvider', () => {
	it('starts the agent with the configured key and the workspace region', async () => {
		await renderWith('test-public-key');

		const agent = screen.getByTestId('fp-agent');
		expect(agent.getAttribute('data-api-key')).toBe('test-public-key');
		expect(agent.getAttribute('data-region')).toBe('us');
		expect(screen.getByTestId('app')).toBeTruthy();
	});

	it('still renders the app when no key is configured', async () => {
		await renderWith(undefined);

		expect(screen.getByTestId('app')).toBeTruthy();
		expect(screen.queryByTestId('fp-agent')).toBeNull();
	});

	it('treats an empty key as no key rather than starting the agent with one', async () => {
		await renderWith('');

		expect(screen.getByTestId('app')).toBeTruthy();
		expect(screen.queryByTestId('fp-agent')).toBeNull();
	});
});
