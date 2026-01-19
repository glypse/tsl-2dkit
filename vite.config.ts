import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig(() => {
	{
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
