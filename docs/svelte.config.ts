import { resolve } from "node:path";
import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import { mdsvex } from "mdsvex";

const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: [vitePreprocess(), mdsvex()],

	kit: {
		adapter: adapter(),
		alias: {
			"tsl-2dkit": resolve("../src")
		}
	},
	extensions: [".svelte", ".svx"],
	compilerOptions: {
		experimental: {
			async: true
		}
	}
};

export default config;
