/**
 * Unit tests for Error Boundary components
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ErrorBoundary, PageErrorBoundary, ModalErrorBoundary } from '@/components/ui/error-boundary';

// Component that throws an error
const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
	if (shouldThrow) {
		throw new Error('Test error');
	}
	return <div>No error</div>;
};

// Suppress console.error for error boundary tests
const originalError = console.error;
beforeAll(() => {
	console.error = vi.fn();
});

afterAll(() => {
	console.error = originalError;
});

describe('ErrorBoundary', () => {
	it('renders children when there is no error', () => {
		render(
			<ErrorBoundary>
				<div>Test content</div>
			</ErrorBoundary>
		);

		expect(screen.getByText('Test content')).toBeInTheDocument();
	});

	it('renders fallback UI when error occurs', () => {
		render(
			<ErrorBoundary>
				<ThrowError shouldThrow={true} />
			</ErrorBoundary>
		);

		expect(screen.getByText('Something went wrong')).toBeInTheDocument();
		expect(screen.getByText(/An unexpected error occurred/)).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /Try again/i })).toBeInTheDocument();
	});

	it('calls onError callback when error occurs', () => {
		const onError = vi.fn();
		render(
			<ErrorBoundary onError={onError}>
				<ThrowError shouldThrow={true} />
			</ErrorBoundary>
		);

		expect(onError).toHaveBeenCalled();
		expect(onError).toHaveBeenCalledWith(expect.any(Error), expect.any(Object));
	});

	it('calls onReset callback when reset button is clicked', async () => {
		const onReset = vi.fn();
		const { rerender } = render(
			<ErrorBoundary onReset={onReset}>
				<ThrowError shouldThrow={true} />
			</ErrorBoundary>
		);

		const resetButton = screen.getByRole('button', { name: /Try again/i });
		resetButton.click();

		// Re-render with no error to simulate reset
		rerender(
			<ErrorBoundary onReset={onReset}>
				<ThrowError shouldThrow={false} />
			</ErrorBoundary>
		);

		expect(onReset).toHaveBeenCalled();
	});

	it('uses custom fallback when provided', () => {
		const customFallback = <div>Custom error message</div>;
		render(
			<ErrorBoundary fallback={customFallback}>
				<ThrowError shouldThrow={true} />
			</ErrorBoundary>
		);

		expect(screen.getByText('Custom error message')).toBeInTheDocument();
		expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
	});

	it('shows error details in development mode', () => {
		const originalEnv = process.env.NODE_ENV;
		process.env.NODE_ENV = 'development';

		render(
			<ErrorBoundary>
				<ThrowError shouldThrow={true} />
			</ErrorBoundary>
		);

		// Error message should be visible in dev mode
		expect(screen.getByText(/Test error/)).toBeInTheDocument();

		process.env.NODE_ENV = originalEnv;
	});
});

describe('PageErrorBoundary', () => {
	it('renders page-specific error UI', () => {
		render(
			<PageErrorBoundary>
				<ThrowError shouldThrow={true} />
			</PageErrorBoundary>
		);

		expect(screen.getByText('Page Error')).toBeInTheDocument();
		expect(screen.getByText(/This page encountered an error/)).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /Reload Page/i })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /Go Back/i })).toBeInTheDocument();
	});
});

describe('ModalErrorBoundary', () => {
	it('renders modal-specific error UI', () => {
		render(
			<ModalErrorBoundary onClose={() => undefined}>
				<ThrowError shouldThrow={true} />
			</ModalErrorBoundary>
		);

		expect(screen.getByText('Something went wrong')).toBeInTheDocument();
		expect(screen.getByText(/This dialog encountered an error/)).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /Close/i })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /Reload/i })).toBeInTheDocument();
	});

	it('calls onClose when close button is clicked', () => {
		const onClose = vi.fn();
		render(
			<ModalErrorBoundary onClose={onClose}>
				<ThrowError shouldThrow={true} />
			</ModalErrorBoundary>
		);

		const closeButton = screen.getByRole('button', { name: /Close/i });
		closeButton.click();

		expect(onClose).toHaveBeenCalled();
	});
});
