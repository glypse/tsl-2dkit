import fs from "fs/promises";

const demosDir = "src/lib/demos";
const outputFile = "src/lib/demos-list.ts";

async function generateDemosList(): Promise<void> {
	try {
		const files = await fs.readdir(demosDir);
		const demoNames = files
			.filter((file) => file.endsWith(".ts"))
			.map((file) => file.replace(".ts", ""))
			.sort();

		const content = `// Auto-generated file. Do not edit manually.
export const demoNames: string[] = ${JSON.stringify(demoNames, null, 2)};
`;

		await fs.writeFile(outputFile, content);
		console.log(
			`Generated ${outputFile} with ${String(demoNames.length)} demos`
		);
	} catch (error) {
		console.error("Error generating demos list:", error);
	}
}

void generateDemosList();
