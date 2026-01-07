/**
 * On-Demand Rendering Demo
 *
 * Demonstrates the new on-demand rendering mode where
 * frames are only rendered when explicitly requested.
 * In this demo, rendering happens only on mouse/touch movement.
 */

import "$demo/style.css";

import { TSLScene2D, voronoi, aspectCorrectedUV } from "$lib";
import { vec2, vec3, uniform, float, mix, smoothstep } from "three/tsl";

// Scene with on-demand rendering (default mode)
const scene = new TSLScene2D(window.innerWidth, window.innerHeight, {
	stats: true,
	renderMode: "on-demand" // This is the default, shown explicitly for clarity
});

// Mouse position uniforms - these change on mouse move
const mouseX = uniform(0.5);
const mouseY = uniform(0.5);

// Voronoi parameters
const voronoiScale = uniform(10);
const exponent = uniform(2);

// Frame counter to show rendering is on-demand
let frameCount = 0;
const frameCounterEl = document.createElement("span");

window.addEventListener("resize", () => {
	scene.setSize(window.innerWidth, window.innerHeight);
	// setSize() automatically calls requestRender() in on-demand mode
});

await scene.build(() => {
	// Increment frame counter each time the node graph is evaluated
	// (In on-demand mode, this only happens when we call requestRender)

	const UV = aspectCorrectedUV("cover");

	// Create voronoi centered on mouse position
	const mousePos = vec2(mouseX, mouseY);

	// Offset UV by mouse position for interactive voronoi
	const voronoiUV = vec3(
		UV.x
			.sub(mousePos.x)
			.add(0.5)
			.mul(voronoiScale)
			.mul(scene.aspectUniform),
		UV.y.sub(mousePos.y).add(0.5).mul(voronoiScale),
		float(0) // Static in Z - no animation since we're on-demand
	);

	const voronoiResult = voronoi(voronoiUV, {
		featureOutput: "f1",
		exponent,
		randomness: float(1)
	});

	// Distance from F1
	const dist = voronoiResult.get("distance").x;

	// Cell color from voronoi
	const cellColor = voronoiResult.get("color");

	// Create a gradient based on distance
	const edgeFactor = smoothstep(float(0), float(0.3), dist);

	// Background gradient based on mouse position
	const bgColor = vec3(mouseX.mul(0.3), mouseY.mul(0.3), float(0.2));

	// Cell interior color
	const innerColor = cellColor.mul(0.8).add(vec3(0.2, 0.1, 0.3));

	// Mix between cell color and edge
	const finalColor = mix(innerColor, bgColor, edgeFactor);

	return finalColor;
});

// Render callback - increment counter
const originalRenderFrame = scene.renderFrame.bind(scene);
scene.renderFrame = async function () {
	frameCount++;
	frameCounterEl.textContent = String(frameCount);
	return originalRenderFrame();
};

// Mouse move triggers render
scene.canvasElement.addEventListener("mousemove", (event) => {
	const rect = scene.canvasElement.getBoundingClientRect();
	mouseX.value = (event.clientX - rect.left) / rect.width;
	mouseY.value = 1 - (event.clientY - rect.top) / rect.height;

	// Request a render since we changed something
	scene.requestRender();
});

// Touch support
scene.canvasElement.addEventListener(
	"touchmove",
	(event) => {
		event.preventDefault();
		const touch = event.touches[0];
		const rect = scene.canvasElement.getBoundingClientRect();
		mouseX.value = (touch.clientX - rect.left) / rect.width;
		mouseY.value = 1 - (touch.clientY - rect.top) / rect.height;

		scene.requestRender();
	},
	{ passive: false }
);

document.body.appendChild(scene.canvasElement);

// Info panel
const info = document.createElement("div");
info.style.cssText =
	"position:fixed;top:10px;left:10px;color:white;font-family:monospace;background:rgba(0,0,0,0.5);padding:10px;border-radius:4px;";
info.innerHTML = `
<strong>On-Demand Rendering Demo</strong><br>
Move mouse to render<br>
Frames rendered: <span id="frameCount">1</span><br>
<br>
<label>Scale: <input type="range" id="scale" min="3" max="25" step="1" value="10"></label><br>
<label>Exponent: <input type="range" id="exponent" min="1" max="6" step="0.5" value="2"></label>
`;
document.body.appendChild(info);

// Replace the span in info with our counter
const frameCountSpan = document.getElementById("frameCount");
if (frameCountSpan) frameCountSpan.replaceWith(frameCounterEl);
frameCounterEl.textContent = "1";

// Scale slider
const scaleSlider = document.getElementById("scale") as HTMLInputElement;
scaleSlider.addEventListener("input", () => {
	voronoiScale.value = parseFloat(scaleSlider.value);
});

// Exponent slider
const exponentSlider = document.getElementById("exponent") as HTMLInputElement;
exponentSlider.addEventListener("input", () => {
	exponent.value = parseFloat(exponentSlider.value);
});
