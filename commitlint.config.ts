import { type UserConfig } from "@commitlint/types";

const config: UserConfig = {
	extends: ["@commitlint/config-conventional"],
	rules: {
		"type-enum": [
			2,
			"always",
			[
				"feat",
				"fix",
				"docs",
				"style",
				"refactor",
				"perf",
				"test",
				"build",
				"ci",
				"chore",
				"revert"
			]
		],
		"scope-empty": [0],
		"scope-enum": [
			1,
			"always",
			[
				"core",
				"blur",
				"color",
				"components",
				"filters",
				"noises",
				"textures",
				"time",
				"utils",
				"demo", // demo commits won't trigger releases
				"deps",
				"no-release"
			]
		]
	}
};

export default config;
