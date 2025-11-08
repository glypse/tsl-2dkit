import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import json from "@eslint/json";
import markdown from "@eslint/markdown";
import css from "@eslint/css";
import { defineConfig } from "eslint/config";

export default defineConfig([
	{ ignores: ["eslint.config.ts", "vite.config.ts"] },
	{
		files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
		plugins: { js },
		extends: ["js/recommended"],
		rules: {
			"func-style": ["warn", "declaration"],
			"require-atomic-updates": "error"
		},
		languageOptions: { globals: globals.browser }
	},
	{
		files: ["**/*.{ts,mts,cts}"],
		extends: [
			...tseslint.configs.strictTypeChecked,
			...tseslint.configs.stylisticTypeChecked
		],
		rules: {
			"@typescript-eslint/consistent-type-definitions": ["error", "type"],
			"no-restricted-syntax": [
				"error",
				{
					selector:
						":matches(PropertyDefinition, MethodDefinition) > PrivateIdentifier.key",
					message: "Use `private` instead"
				}
			]
		},
		languageOptions: {
			parser: tseslint.parser,
			parserOptions: {
				project: true
			}
		}
	},
	{
		files: ["**/*.json"],
		ignores: ["**/tsconfig.json"],
		plugins: { json },
		language: "json/json",
		extends: ["json/recommended"]
	},
	{
		files: ["**/*.jsonc"],
		plugins: { json },
		language: "json/jsonc",
		extends: ["json/recommended"]
	},
	{
		files: ["**/*.json5"],
		plugins: { json },
		language: "json/json5",
		extends: ["json/recommended"]
	},
	{
		files: ["**/*.md"],
		plugins: { markdown },
		language: "markdown/commonmark",
		extends: ["markdown/recommended"]
	},
	{
		files: ["**/*.css"],
		plugins: { css },
		language: "css/css",
		extends: ["css/recommended"]
	}
]);
