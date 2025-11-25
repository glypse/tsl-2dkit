import "$demo/style.css";

import { Canvas2D, textNode, setBackgroundColor } from "$lib";
import { uv, uniform, vec2, floor, time, sin } from "three/tsl";
import { lerp } from "three/src/math/MathUtils.js";

function getRelativeMousePosition(
	canvasElement: HTMLCanvasElement,
	event: MouseEvent
): { x: number; y: number } {
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

window.addEventListener("resize", () => {
	canvas.resize(window.innerWidth, window.innerHeight);
});

const tileAmount = uniform(8);
const speed = uniform(1);
const waveStrength = uniform(0.05);

await canvas.draw(() => {
	const UV = uv();

	waveStrength.value = lerp(0, 0.1, mouse.x);

	setBackgroundColor("blue");

	const textSampler = textNode({
		string: "a",
		size: Math.min(canvas.widthUniform.value, canvas.heightUniform.value),
		weight: lerp(200, 800, mouse.y),
		color: "#00ff00",
		fontFamily: "Fustat"
	});
	const tileX = floor(UV.x.mul(tileAmount).mul(canvas.aspectUniform));
	const tileY = floor(UV.y.mul(tileAmount));

	const wave = sin(time.mul(speed).add(tileX.add(tileY))).mul(waveStrength);

	const displacedUV = UV.add(vec2(wave, 0));

	return textSampler(displacedUV);
});

canvas.canvasElement.addEventListener("mousemove", (event) => {
	const pos = getRelativeMousePosition(canvas.canvasElement, event);
	mouse.x = pos.x;
	mouse.y = pos.y;
});

document.body.appendChild(canvas.canvasElement);
