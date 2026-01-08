/**
 * FeedbackTexture Demo
 *
 * Demonstrates the ping-pong feedback loop feature.
 * The previous frame is sampled and mixed with the current frame
 * to create a trailing/echo effect.
 */

import "$demo/style.css";

import { TSLScene2D, aspectCorrectedUV, feedback } from "$lib";
import {
	vec2,
	vec3,
	vec4,
	time,
	sin,
	cos,
	float,
	uniform,
	length,
	smoothstep,
	max
} from "three/tsl";
import { Node } from "three/webgpu";

const scene = new TSLScene2D(window.innerWidth, window.innerHeight, {
	stats: true,
	renderMode: "continuous" // Need continuous for time-based animation
});

// Mouse position uniform
const mouseX = uniform(0.5);
const mouseY = uniform(0.5);

// Feedback decay (how much the previous frame fades)
const decay = uniform(0.97);

window.addEventListener("resize", () => {
	scene.setSize(window.innerWidth, window.innerHeight);
});

await scene.build(() => {
	const UV = aspectCorrectedUV("cover", scene.aspectUniform, "generation");

	// Create a moving circle that follows the mouse
	const circleCenter = vec2(mouseX, mouseY);
	const circleRadius = float(0.05);

	// Add some time-based wobble
	const wobble = vec2(
		sin(time.mul(3)).mul(0.02),
		cos(time.mul(2.5)).mul(0.02)
	);

	const distToCircle = length(UV.sub(circleCenter).sub(wobble));
	const circleMask = smoothstep(
		circleRadius,
		circleRadius.sub(0.01),
		distToCircle
	);

	// Rainbow color based on time
	const hue = time.mul(0.5);
	const circleColor = vec3(
		sin(hue).mul(0.5).add(0.5),
		sin(hue.add(2.094)).mul(0.5).add(0.5), // 2π/3
		sin(hue.add(4.189)).mul(0.5).add(0.5) // 4π/3
	);

	// Current frame: circle on black background
	const currentFrame = vec4(circleColor.mul(circleMask), 1.0);

	// Create feedback effect using the new API
	// The composite function receives (current, previous) and returns the combined result
	const trailEffect = feedback(
		currentFrame,
		(current: Node, previous: Node) => {
			// Fade the previous frame
			const fadedPrevious = previous.mul(decay);

			// The new frame is the max of current and faded previous (creates bright trails)
			const combined = max(fadedPrevious, current);

			return combined;
		}
	);

	return trailEffect.rgb;
});

// Track mouse position
scene.canvasElement.addEventListener("mousemove", (event) => {
	const rect = scene.canvasElement.getBoundingClientRect();
	mouseX.value = (event.clientX - rect.left) / rect.width;
	mouseY.value = 1 - (event.clientY - rect.top) / rect.height; // Flip Y for UV coords
});

// Touch support
scene.canvasElement.addEventListener("touchmove", (event) => {
	event.preventDefault();
	const touch = event.touches[0];
	const rect = scene.canvasElement.getBoundingClientRect();
	mouseX.value = (touch.clientX - rect.left) / rect.width;
	mouseY.value = 1 - (touch.clientY - rect.top) / rect.height;
});

document.body.appendChild(scene.canvasElement);

// Info and controls
const info = document.createElement("div");
info.style.cssText =
	"position:fixed;top:10px;left:10px;color:white;font-family:monospace;background:rgba(0,0,0,0.5);padding:10px;border-radius:4px;";
info.innerHTML = `
<strong>FeedbackTexture Demo</strong><br>
Move mouse to draw trails<br>
<label>Decay: <input type="range" id="decay" min="0.8" max="0.99" step="0.01" value="0.97"></label>
`;
document.body.appendChild(info);

// Decay slider
const decaySlider = document.getElementById("decay") as HTMLInputElement;
decaySlider.addEventListener("input", () => {
	decay.value = parseFloat(decaySlider.value);
});
