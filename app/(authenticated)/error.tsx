'use client';

import { useEffect } from 'react';

export default function AuthenticatedError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		console.error('Authenticated layout error:', error);
	}, [error]);

	return (
		<div className="flex min-h-screen flex-col items-center justify-center p-4">
			<div className="w-full max-w-md rounded-lg bg-white p-8 shadow-sm text-center">
				<h2 className="text-xl font-semibold text-gray-900 mb-2">Something went wrong</h2>
				<p className="text-gray-500 mb-6">An unexpected error occurred. Please try again.</p>
				{error.digest && <p className="text-xs text-gray-400 mb-4">Error ID: {error.digest}</p>}
				<button
					onClick={reset}
					className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
				>
					Try again
				</button>
			</div>
		</div>
	);
}
