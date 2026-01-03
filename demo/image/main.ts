import "$demo/style.css";

import { Canvas2D, ImageTexture } from "$lib";
import { mix, color } from "three/tsl";

const canvas = new Canvas2D(window.innerWidth, window.innerHeight, {
	stats: true,
	antialias: "none"
});

const imageTexture = new MediaTexture({
	src: "./test-video.mp4",
	anchorX: "left",
	anchorY: "bottom",
	debug: true
});

window.addEventListener("resize", () => {
	canvas.resize(window.innerWidth, window.innerHeight);
});

await canvas.draw(() => {
	const imageSample = imageTexture.sample();

	// Composite image over a background color
	const backgroundColor = color("#ff0000");
	const composited = mix(backgroundColor, imageSample.rgb, imageSample.a);

	return composited;
});

document.body.appendChild(canvas.canvasElement);
