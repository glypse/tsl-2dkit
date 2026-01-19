import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { threeMinifier } from "@yushijinhun/three-minifier-rollup";
import { defineConfig } from "vite";
import devtoolsJson from "vite-plugin-devtools-json";

export default defineConfig({
	plugins: [
		threeMinifier(),
		basicSsl(),
		tailwindcss(),
		sveltekit(),
		devtoolsJson()
	],
	server: {
		fs: {
			strict: false
		}
	}
});
