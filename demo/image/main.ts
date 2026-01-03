import "$demo/style.css";

import { Canvas2D, MediaTexture } from "$lib";
import { mix, color, uv } from "three/tsl";

const canvas = new Canvas2D(window.innerWidth, window.innerHeight, {
	stats: true,
	antialias: "none"
});

const imageTexture = new MediaTexture({
	src: "./test-image.png",
	anchorX: "left",
	anchorY: "bottom",
	debug: false
});
imageTexture.interpolation = "nearest";
imageTexture.wrapMode = "edge";

window.addEventListener("resize", () => {
	canvas.resize(window.innerWidth, window.innerHeight);
});

await canvas.draw(() => {
	const imageSample = imageTexture.sample(uv().div(20));

	// Composite image over a background color
	const backgroundColor = color("#ff0000");
	const composited = mix(backgroundColor, imageSample.rgb, imageSample.a);

	return composited;
});

document.body.appendChild(canvas.canvasElement);
