import prettier from 'eslint-config-prettier';
import path from 'node:path';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import { defineConfig, includeIgnoreFile } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';

const gitignorePath = path.resolve(import.meta.dirname, '.gitignore');

export default defineConfig(
	includeIgnoreFile(gitignorePath),
	{ ignores: ['worker-configuration.d.ts'] },
	js.configs.recommended,
	ts.configs.recommended,
	svelte.configs.recommended,
	prettier,
	svelte.configs.prettier,
	{
		languageOptions: { globals: { ...globals.browser, ...globals.node } },
		rules: {
			// typescript-eslint strongly recommend that you do not use the no-undef lint rule on TypeScript projects.
			// see: https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
			'no-undef': 'off'
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				parser: ts.parser
			}
		}
	},
	{
		// Security bans (spec: Boundaries → Never). Don't disable these inline; change the spec first.
		rules: {
			'svelte/no-at-html-tags': 'error',
			'no-eval': 'error',
			'no-implied-eval': 'error',
			'no-new-func': 'error',
			'no-restricted-properties': [
				'error',
				{
					object: 'sql',
					property: 'raw',
					message: 'sql.raw bypasses parameterization. Use the sql`` template with ${values}.'
				}
			],
			'no-restricted-syntax': [
				'error',
				{
					selector:
						'AssignmentExpression > MemberExpression.left[property.name=/^(innerHTML|outerHTML)$/]',
					message: 'Assigning HTML strings is an XSS risk. Use Svelte markup or textContent.'
				},
				{
					selector: "CallExpression[callee.property.name='insertAdjacentHTML']",
					message: 'insertAdjacentHTML is an XSS risk. Use Svelte markup.'
				},
				{
					selector: "CallExpression[callee.object.name='document'][callee.property.name='write']",
					message: 'document.write is an XSS risk.'
				}
			],
			'svelte/no-dom-manipulating': 'error'
		}
	}
);
