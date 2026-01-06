import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

import basicSsl from "@vitejs/plugin-basic-ssl";
import { threeMinifier } from "@yushijinhun/three-minifier-rollup";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ command }) => {
	if (command === "serve") {
		return {
			root: "demo",
			plugins: [basicSsl(), threeMinifier()],
			resolve: {
				alias: {
					$lib: resolve(__dirname, "src"),
					$demo: resolve(__dirname, "demo")
				}
			}
		};
	} else {
		return {
			build: {
				emptyOutDir: false,
				lib: {
					entry: resolve(__dirname, "src/index.ts"),
					name: "tsl-2dkit",
					formats: ["es", "umd"],
					fileName: (format) =>
						format === "umd" ? "tsl-2dkit.umd.cjs" : "tsl-2dkit.js"
				},
				rolldownOptions: {
					external: ["three"],
					output: {
						globals: {
							three: "THREE"
						}
					}
				}
			}
		};
	}
});
