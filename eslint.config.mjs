import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';

export default [
	{
		ignores: ['.next/**', 'out/**', 'build/**', 'node_modules/**', '*.config.{js,mjs,ts}'],
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
		},
	},
	prettier,
];
