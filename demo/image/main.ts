import "$demo/style.css";

import { Canvas2D, MediaTexture } from "$lib";
import { mix, color, vec2, uv } from "three/tsl";

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
imageTexture.wrapMode = "repeat";

window.addEventListener("resize", () => {
	canvas.resize(window.innerWidth, window.innerHeight);
});

await canvas.draw(() => {
	// Get aspect ratios - imageTexture.aspectRatioUniform auto-updates when media loads
	const canvasAspect = canvas.aspectUniform;
	const imageAspect = imageTexture.aspectRatioUniform;

	// Calculate scale to fit image in canvas while preserving aspect ratio (contain mode)
	const scaleX = canvasAspect
		.greaterThan(imageAspect)
		.select(imageAspect.div(canvasAspect), 1);
	const scaleY = canvasAspect
		.lessThan(imageAspect)
		.select(canvasAspect.div(imageAspect), 1);

	// Transform UV to preserve aspect ratio
	const rawUV = uv();
	const centeredUV = rawUV.sub(vec2(0.5));
	const scaledUV = vec2(centeredUV.x.div(scaleX), centeredUV.y.div(scaleY));
	const aspectCorrectedUV = scaledUV.add(vec2(0.5));

	const imageSample = imageTexture.sample(aspectCorrectedUV);

	// Composite image over a background color
	const backgroundColor = color("#1a1a1a");
	const composited = mix(backgroundColor, imageSample.rgb, imageSample.a);

	return composited;
});

document.body.appendChild(canvas.canvasElement);
