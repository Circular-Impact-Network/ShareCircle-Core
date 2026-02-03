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
	},
	resolve: {
		alias: {
			'@': path.resolve(__dirname, './'),
		},
	},
});
