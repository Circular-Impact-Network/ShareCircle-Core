'use client';

import React, { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';
import { Button } from './button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card';

interface ErrorBoundaryProps {
	children: ReactNode;
	fallback?: ReactNode;
	/** Optional callback when an error is caught */
	onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
	/** Optional custom reset handler */
	onReset?: () => void;
}

interface ErrorBoundaryState {
	hasError: boolean;
	error: Error | null;
}

/**
 * Error Boundary component that catches JavaScript errors in child components.
 * Displays a fallback UI instead of crashing the whole app.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
	constructor(props: ErrorBoundaryProps) {
		super(props);
		this.state = { hasError: false, error: null };
	}

	static getDerivedStateFromError(error: Error): ErrorBoundaryState {
		return { hasError: true, error };
	}

	componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
		// Log to console in development
		console.error('Error caught by ErrorBoundary:', error, errorInfo);
		
		// Call optional error callback
		this.props.onError?.(error, errorInfo);
	}

	handleReset = () => {
		this.setState({ hasError: false, error: null });
		this.props.onReset?.();
	};

	render() {
		if (this.state.hasError) {
			// If custom fallback provided, use it
			if (this.props.fallback) {
				return this.props.fallback;
			}

			// Default fallback UI
			return (
				<Card className="mx-auto max-w-md mt-8 border-destructive/50">
					<CardHeader className="text-center">
						<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
							<AlertTriangle className="h-6 w-6 text-destructive" />
						</div>
						<CardTitle>Something went wrong</CardTitle>
						<CardDescription>
							An unexpected error occurred. Please try again.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						{process.env.NODE_ENV === 'development' && this.state.error && (
							<div className="rounded-lg bg-muted p-3 text-xs font-mono overflow-auto max-h-32">
								{this.state.error.message}
							</div>
						)}
						<Button onClick={this.handleReset} className="w-full gap-2">
							<RefreshCcw className="h-4 w-4" />
							Try again
						</Button>
					</CardContent>
				</Card>
			);
		}

		return this.props.children;
	}
}

/**
 * Higher-order component to wrap any component with an error boundary.
 */
export function withErrorBoundary<P extends object>(
	WrappedComponent: React.ComponentType<P>,
	errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
	const WithErrorBoundary = (props: P) => (
		<ErrorBoundary {...errorBoundaryProps}>
			<WrappedComponent {...props} />
		</ErrorBoundary>
	);

	WithErrorBoundary.displayName = `WithErrorBoundary(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;

	return WithErrorBoundary;
}

/**
 * Specialized error boundary for page-level components.
 * Provides a more prominent UI for page-level errors.
 */
export function PageErrorBoundary({ children }: { children: ReactNode }) {
	return (
		<ErrorBoundary
			fallback={
				<div className="flex min-h-[50vh] flex-col items-center justify-center p-8">
					<Card className="max-w-md border-destructive/50">
						<CardHeader className="text-center">
							<div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
								<AlertTriangle className="h-8 w-8 text-destructive" />
							</div>
							<CardTitle className="text-xl">Page Error</CardTitle>
							<CardDescription>
								This page encountered an error and couldn&apos;t load properly.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<Button
								onClick={() => window.location.reload()}
								className="w-full gap-2"
							>
								<RefreshCcw className="h-4 w-4" />
								Reload Page
							</Button>
							<Button
								variant="outline"
								onClick={() => window.history.back()}
								className="w-full"
							>
								Go Back
							</Button>
						</CardContent>
					</Card>
				</div>
			}
		>
			{children}
		</ErrorBoundary>
	);
}

/**
 * Specialized error boundary for modal/dialog components.
 * Provides a compact UI suitable for modals.
 */
export function ModalErrorBoundary({ children, onClose }: { children: ReactNode; onClose?: () => void }) {
	return (
		<ErrorBoundary
			fallback={
				<div className="flex flex-col items-center justify-center p-6 text-center">
					<div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
						<AlertTriangle className="h-6 w-6 text-destructive" />
					</div>
					<h3 className="font-semibold">Something went wrong</h3>
					<p className="mt-1 text-sm text-muted-foreground">
						This dialog encountered an error.
					</p>
					<div className="mt-4 flex gap-2">
						<Button
							size="sm"
							variant="outline"
							onClick={onClose}
						>
							Close
						</Button>
						<Button
							size="sm"
							onClick={() => window.location.reload()}
						>
							Reload
						</Button>
					</div>
				</div>
			}
		>
			{children}
		</ErrorBoundary>
	);
}
