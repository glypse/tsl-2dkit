import { fileURLToPath } from "node:url";
import { includeIgnoreFile } from "@eslint/compat";
import css from "@eslint/css";
import jseslint from "@eslint/js";
import json from "@eslint/json";
import markdown from "@eslint/markdown";
import { defineConfig } from "eslint/config";
import prettier from "eslint-config-prettier";
import importPlugin from "eslint-plugin-import";
import jsdoc from "eslint-plugin-jsdoc";
import sveslint from "eslint-plugin-svelte";
import globals from "globals";
import tseslint from "typescript-eslint";
import preferThreeWebGPU from "./eslint-rules/prefer-three-webgpu.ts";

const gitignorePath = fileURLToPath(new URL("./.gitignore", import.meta.url));

export default defineConfig(
	includeIgnoreFile(gitignorePath),
	{
		files: ["**/*.{js,mjs,cjs,ts,mts,cts,svelte,svelte.ts,svelte.js}"],
		extends: [
			jseslint.configs.recommended,
			...tseslint.configs.strictTypeChecked,
			...tseslint.configs.stylisticTypeChecked,
			jsdoc.configs["flat/recommended-typescript"]
		],
		plugins: {
			js: jseslint,
			import: importPlugin,
			"local-rules": {
				rules: {
					"prefer-three-webgpu": preferThreeWebGPU
				}
			}
		},
		rules: {
			"local-rules/prefer-three-webgpu": "warn",
			"import/no-duplicates": ["warn", { "prefer-inline": true }],
			"import/order": [
				"warn",
				{
					groups: [
						"builtin",
						"external",
						"internal",
						["parent", "sibling", "index"]
					],
					"newlines-between": "never",
					alphabetize: {
						order: "asc",
						caseInsensitive: true
					}
				}
			],
			"func-style": ["warn", "declaration"],
			"require-atomic-updates": "error",
			"arrow-body-style": ["warn", "as-needed"],
			"no-warning-comments": "warn",
			"max-len": [
				"warn",
				{
					code: 80,
					ignoreComments: true,
					ignoreUrls: true,
					ignoreStrings: true,
					ignoreTemplateLiterals: true,
					ignoreRegExpLiterals: true
				}
			],
			"jsdoc/require-description": "warn",
			"jsdoc/require-jsdoc": [
				"warn",
				{
					contexts: [
						"ClassDeclaration",
						"MethodDefinition",
						"TSMethodSignature",
						"TSTypeAliasDeclaration",
						"TSInterfaceDeclaration"
					],
					publicOnly: true
				}
			],
			"jsdoc/tag-lines": [
				"warn",
				"any",
				{ startLines: 1, applyToEndTag: false }
			],
			"jsdoc/no-defaults": "off",
			"jsdoc/require-param": ["warn"],
			"jsdoc/check-param-names": ["warn"],
			"jsdoc/check-tag-names": "warn",
			// If as a user of this library you would like error types,
			// please open an issue
			"jsdoc/require-throws-type": "off",

			// TypeScript config
			"@typescript-eslint/consistent-type-definitions": ["warn", "type"],
			"@typescript-eslint/consistent-type-imports": [
				"warn",
				{
					prefer: "type-imports",
					fixStyle: "inline-type-imports"
				}
			],
			"no-restricted-syntax": [
				"warn",
				{
					selector:
						":matches(PropertyDefinition, MethodDefinition) > PrivateIdentifier.key",
					message: "Use `private` instead"
				}
			],
			"@typescript-eslint/no-unused-vars": "warn",
			"@typescript-eslint/explicit-function-return-type": [
				"warn",
				{ allowExpressions: true }
			]
		},
		languageOptions: { globals: { ...globals.browser, ...globals.node } },
		settings: {
			jsdoc: {
				structuredTags: {
					remarks: {}
				}
			}
		}
	},
	...sveslint.configs.recommended.map((config) => ({
		...config,
		files: ["**/*.svelte", "**/*.svelte.ts", "**/*.svelte.js"]
	})),
	prettier,
	...sveslint.configs.prettier.map((config) => ({
		...config,
		files: ["**/*.svelte", "**/*.svelte.ts", "**/*.svelte.js"]
	})),
	{
		files: ["**/*.{ts,mts,cts}"],
		languageOptions: {
			parser: tseslint.parser,
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname
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
		ignores: ["CHANGELOG.md"],
		plugins: { markdown },
		language: "markdown/gfm",
		extends: ["markdown/recommended"]
	},
	{
		files: ["**/*.css"],
		plugins: { css },
		language: "css/css",
		extends: ["css/recommended"]
	},
	{
		files: ["**/*.svelte", "**/*.svelte.ts", "**/*.svelte.js"],
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: [".svelte"],
				parser: tseslint.parser
			}
		},
		rules: {
			"svelte/no-navigation-without-resolve": "off"
		}
	}
);
