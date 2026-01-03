import "$demo/style.css";

import { Canvas2D, MediaTexture, getAspectCorrectedUV } from "$lib";
import { mix, color } from "three/tsl";

const canvas = new Canvas2D(window.innerWidth, window.innerHeight, {
	stats: true,
	antialias: "none"
});

const imageTexture = new MediaTexture({
	src: "./test-image.webp",
	anchorX: "left",
	anchorY: "bottom",
	debug: false
});
imageTexture.wrapMode = "edge";

window.addEventListener("resize", () => {
	canvas.resize(window.innerWidth, window.innerHeight);
});

await canvas.draw(() => {
	// Use the new getAspectCorrectedUV function with the image's aspect ratio
	const aspectCorrectedUV = getAspectCorrectedUV(
		"contain",
		imageTexture.aspectRatioUniform,
		"sampling"
	);

	const imageSample = imageTexture.sample(aspectCorrectedUV);

	// Composite image over a background color
	const backgroundColor = color("#1a1a1a");
	const composited = mix(backgroundColor, imageSample.rgb, imageSample.a);

	return composited;
});

document.body.appendChild(canvas.canvasElement);
