import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

import basicSsl from "@vitejs/plugin-basic-ssl";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ command }) => {
	if (command === "serve") {
		return {
			root: "demo",
			plugins: [basicSsl()],
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
					name: "three-tsl-lab",
					formats: ["es", "umd"],
					fileName: (format) =>
						format === "umd"
							? "three-tsl-lab.umd.cjs"
							: "three-tsl-lab.js"
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
