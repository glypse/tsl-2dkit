import { color } from "three/tsl";
import { TSLScene2D } from "tsl-2dkit";

/**
 * Quickstart Demo
 *
 * @returns A cleanup function to dispose of all resources
 */
export default async function (): Promise<() => void> {
	const container = document.getElementById("demo-container");

	const scene = new TSLScene2D(window.innerWidth, window.innerHeight);

	function resizeHandler(): void {
		scene.setSize(window.innerWidth, window.innerHeight);
	}

	window.addEventListener("resize", resizeHandler);

	await scene.build(() => {
		const final = color("#ff8c00");
		return final;
	});

	container?.appendChild(scene.canvasElement);

	return () => {
		// Remove event listeners
		window.removeEventListener("resize", resizeHandler);

		// Remove DOM elements
		container?.removeChild(scene.canvasElement);

		// Dispose TSL-2D Kit resources
		scene.dispose();
	};
}
