import "$demo/style.css";

import { Canvas2D, TextTexture } from "$lib";
import { uniform, floor, time, sin, color, mix, uv, vec2 } from "three/tsl";
import { lerp } from "three/src/math/MathUtils.js";

function getRelativeMousePosition(
	canvasElement: HTMLCanvasElement,
	event: MouseEvent
) {
	const rect = canvasElement.getBoundingClientRect();
	return {
		x: (event.clientX - rect.left) / rect.width,
		y: (event.clientY - rect.top) / rect.height
	};
}

const canvas = new Canvas2D(window.innerWidth, window.innerHeight, {
	stats: true,
	antialias: "none"
});

const mouse = { x: 0.5, y: 0.5 };

const textTexture = new TextTexture({
	string: "a",
	size: Math.min(window.innerWidth, window.innerHeight),
	// Initial value, not reactive value
	weight: lerp(200, 800, mouse.y),
	color: "#00ff00",
	fontFamily: "Fustat",
	debug: true,
	padding: 0
});

window.addEventListener("resize", () => {
	canvas.resize(window.innerWidth, window.innerHeight);
	textTexture.config.size = Math.min(window.innerWidth, window.innerHeight);
	textTexture.needsUpdate = true;
});

const tileAmount = uniform(8);
const speed = uniform(1);

// Initial value, not reactive value
const waveStrength = uniform(lerp(0, 0.1, mouse.x));

await canvas.draw(() => {
	const UV = uv();

	const tileX = floor(UV.x.mul(tileAmount).mul(canvas.aspectUniform));
	const tileY = floor(UV.y.mul(tileAmount));

	const wave = sin(time.mul(speed).add(tileX.add(tileY))).mul(waveStrength);

	const textSample = textTexture.sample(
		uv().sub(vec2(0.5, 0.5)).add(vec2(wave, 0))
	);

	const compositedText = mix(color("#0000ff"), textSample.rgb, textSample.a);

	return compositedText;
});

canvas.canvasElement.addEventListener("mousemove", (event) => {
	const mouse = getRelativeMousePosition(canvas.canvasElement, event);
	waveStrength.value = lerp(0, 0.1, mouse.x);

	textTexture.config.weight = lerp(200, 800, mouse.y);
	textTexture.needsUpdate = true;
});

document.body.appendChild(canvas.canvasElement);
