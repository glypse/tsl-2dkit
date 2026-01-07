import "$demo/style.css";

import { TSLScene2D, MediaTexture, aspectCorrectedUV } from "$lib";
import { mix, color } from "three/tsl";

const scene = new TSLScene2D(window.innerWidth, window.innerHeight, {
	stats: true,
	antialias: "none"
});

const mediaTexture = new MediaTexture({
	src: "./test.webp",
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
	// Use the new aspectCorrectedUV function with the image's aspect ratio
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

document.body.appendChild(scene.canvasElement);
