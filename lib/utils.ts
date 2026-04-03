import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

/**
 * Extract a user-friendly error message from an RTK Query error.
 */
export function extractRtkErrorMessage(error: unknown, fallback: string): string {
	if (error && typeof error === 'object' && 'data' in error) {
		const data = (error as { data?: { error?: string } }).data;
		if (data?.error) return data.error;
	}
	return fallback;
}
