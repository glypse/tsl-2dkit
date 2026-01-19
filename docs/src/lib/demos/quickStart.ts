import { color } from "three/tsl";
import { TSLScene2D } from "tsl-2dkit";

const container = document.getElementById("demo-container");

/**
 * Quickstart Demo
 */
export default async function (): Promise<void> {
	const scene = new TSLScene2D(window.innerWidth, window.innerHeight);

	window.addEventListener("resize", () => {
		scene.setSize(window.innerWidth, window.innerHeight);
	});

	await scene.build(() => {
		const final = color("#ff8c00");
		return final;
	});

	container?.appendChild(scene.canvasElement);
}
