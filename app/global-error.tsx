'use client';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
	return (
		<html>
			<body className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
				<div className="w-full max-w-md rounded-lg bg-white p-8 shadow-sm text-center">
					<h1 className="text-2xl font-semibold text-gray-900 mb-2">Something went wrong</h1>
					<p className="text-gray-500 mb-6">An unexpected error occurred. Please try again.</p>
					{error.digest && <p className="text-xs text-gray-400 mb-4">Error ID: {error.digest}</p>}
					<button
						onClick={reset}
						className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
					>
						Try again
					</button>
				</div>
			</body>
		</html>
	);
}
