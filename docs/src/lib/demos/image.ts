import { mix, color } from "three/tsl";
import { TSLScene2D, MediaTexture, aspectCorrectedUV } from "tsl-2dkit";

const container = document.getElementById("demo-container");

/**
 * Media demo.
 *
 * To show the {@link MediaTexture}
 */
export default async function (): Promise<void> {
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

	window.addEventListener("resize", () => {
		scene.setSize(window.innerWidth, window.innerHeight);
	});

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
}
