import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
	plugins: [react()],
	test: {
		environment: 'happy-dom',
		setupFiles: ['./tests/setup/vitest.setup.ts'],
		globals: true,
		include: ['tests/unit/**/*.{test,spec}.{ts,tsx}'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json-summary'],
			reportsDirectory: './coverage',
			exclude: [
				'tests/**',
				'*.config.*',
				'app/**',
				'components/**',
				'lib/redux/**',
				'lib/redux/api/**',
				'lib/redux/slices/**',
			],
			thresholds: {
				lines: 40,
				functions: 40,
				branches: 35,
				statements: 40,
			},
		},
	},
	resolve: {
		alias: {
			'@': path.resolve(__dirname, './'),
		},
	},
});
