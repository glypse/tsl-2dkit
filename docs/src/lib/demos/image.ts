import { mix, color } from "three/tsl";
import { TSLScene2D, MediaTexture, aspectCorrectedUV } from "tsl-2dkit";

/**
 * Media demo.
 *
 * To show the {@link MediaTexture}
 *
 * @returns A cleanup function to dispose of all resources
 */
export default async function (): Promise<() => void> {
	const container = document.getElementById("demo-container");

	const scene = new TSLScene2D(window.innerWidth, window.innerHeight, {
		stats: true,
		antialias: "none"
	});

	const mediaTexture = new MediaTexture({
		src: "/test.webp",
		anchorX: "left",
		anchorY: "bottom",
		debug: false
	});
	mediaTexture.wrapMode = "edge";

	// Wait for media to be ready before building the scene to avoid race condition
	await mediaTexture.waitUntilReady();

	function resizeHandler(): void {
		scene.setSize(window.innerWidth, window.innerHeight);
	}

	window.addEventListener("resize", resizeHandler);

	await scene.build(() => {
		const UV = aspectCorrectedUV(
			"contain",
			mediaTexture.aspectUniform,
			"sampling"
		);

		const imageSample = mediaTexture.sample(UV);

		// Composite image over a background color
		const backgroundColor = color("#1a1a1a");
		const composited = mix(backgroundColor, imageSample.rgb, imageSample.a);

		return composited;
	});

	container?.appendChild(scene.canvasElement);

	return () => {
		// Remove event listeners
		window.removeEventListener("resize", resizeHandler);

		// Remove DOM elements
		container?.removeChild(scene.canvasElement);

		// Dispose TSL-2D Kit resources
		mediaTexture.dispose();
		scene.dispose();
	};
}
