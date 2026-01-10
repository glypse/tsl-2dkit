import css from "@eslint/css";
import js from "@eslint/js";
import json from "@eslint/json";
import markdown from "@eslint/markdown";
import { defineConfig } from "eslint/config";
import importPlugin from "eslint-plugin-import";
import jsdoc from "eslint-plugin-jsdoc";
import tsdoc from "eslint-plugin-tsdoc";
import globals from "globals";
import tseslint from "typescript-eslint";
import preferThreeWebGPU from "./eslint-rules/prefer-three-webgpu.cjs";

export default defineConfig([
	{ ignores: ["dist/**"] },
	{
		files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
		plugins: {
			js,
			import: importPlugin,
			"local-rules": {
				rules: {
					"prefer-three-webgpu": preferThreeWebGPU
				}
			}
		},
		extends: ["js/recommended"],
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
			]
		},
		languageOptions: { globals: globals.browser }
	},
	{
		files: ["**/*.{ts,mts,cts}"],
		plugins: { tsdoc, jsdoc },
		extends: [
			...tseslint.configs.strictTypeChecked,
			...tseslint.configs.stylisticTypeChecked,
			jsdoc.configs["flat/recommended-typescript"]
		],
		rules: {
			"tsdoc/syntax": "warn",
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
			"jsdoc/require-param": [
				"warn",
				{
					// TODO: find a way to enforce documentation of object properties
					checkDestructured: false
				}
			],
			"jsdoc/check-param-names": [
				"warn",
				{
					checkDestructured: false
				}
			],
			// tsdoc/syntax already validates tag names
			"jsdoc/check-tag-names": "off",
			// Annoying to deal with tsdoc and overkill for this project
			// If as a user of this library you would like error types,
			// please open an issue
			"jsdoc/require-throws-type": "off"
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
		language: "markdown/gfm",
		extends: ["markdown/recommended"]
	},
	{
		files: ["**/*.css"],
		plugins: { css },
		language: "css/css",
		extends: ["css/recommended"]
	}
]);
