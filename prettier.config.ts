import { type Config } from "prettier";

const config: Config = {
	tabWidth: 4,
	useTabs: true,
	trailingComma: "none",
	printWidth: 80,
	plugins: ["prettier-plugin-svelte", "prettier-plugin-tailwindcss"],
	overrides: [
		{
			files: "*.svelte",
			options: {
				parser: "svelte"
			}
		}
	],
	tailwindStylesheet: "./docs/src/routes/layout.css"
};

export default config;
