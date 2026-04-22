import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';

export default [
	{
		ignores: [
			'.next/**',
			'out/**',
			'build/**',
			'node_modules/**',
			'*.config.{js,mjs,ts}',
			'public/**',
			'.agents/**',
			'.claude/**',
			'coverage/**',
			'graphify-out/**',
		],
	},
	js.configs.recommended,
	...tseslint.configs.recommended,
	{
		plugins: {
			react,
			'react-hooks': reactHooks,
		},
		settings: {
			react: {
				version: 'detect',
			},
		},
		rules: {
			...react.configs.recommended.rules,
			...reactHooks.configs.recommended.rules,
			'react/react-in-jsx-scope': 'off',
			'react/prop-types': 'off',
			'@typescript-eslint/no-unused-vars': [
				'error',
				{
					argsIgnorePattern: '^_',
					varsIgnorePattern: '^_',
					caughtErrorsIgnorePattern: '^_',
				},
			],
		},
	},
	// Playwright + Vitest use patterns that don't always match browser React rules
	{
		files: ['tests/**/*.{ts,tsx}'],
		rules: {
			'react-hooks/rules-of-hooks': 'off',
			'no-empty-pattern': 'off',
			'@typescript-eslint/no-unused-vars': 'off',
		},
	},
	prettier,
];
