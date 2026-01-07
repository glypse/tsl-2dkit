import "$demo/style.css";

import { TSLScene2D, MediaTexture, aspectCorrectedUV } from "$lib";
import { mix, color } from "three/tsl";

const scene = new TSLScene2D(window.innerWidth, window.innerHeight, {
	stats: true,
	antialias: "none"
});

// TODO: Since this renders on request, we should only render once the mediaTexture is ready

const mediaTexture = new MediaTexture({
	src: "./test.webp",
	anchorX: "left",
	anchorY: "bottom",
	debug: false
});
mediaTexture.wrapMode = "edge";

window.addEventListener("resize", () => {
	scene.resize(window.innerWidth, window.innerHeight);
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
