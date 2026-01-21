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
import { type Node } from "three/webgpu";
import {
	type FeedbackTextureNode,
	TSLScene2D,
	UniformSlider,
	aspectCorrectedUV,
	feedback
} from "tsl-2dkit";

/**
 * FeedbackTexture Demo
 *
 * Demonstrates the ping-pong feedback loop feature. The previous frame is
 * sampled and mixed with the current frame to create a trailing/echo effect.
 *
 * @returns A cleanup function to dispose of all resources
 */
export default async function (): Promise<() => void> {
	const container = document.getElementById("demo-container");

	const scene = new TSLScene2D(window.innerWidth, window.innerHeight, {
		stats: true,
		renderMode: "continuous"
	});

	// Mouse position uniform
	const mouseX = uniform(0.5);
	const mouseY = uniform(0.5);

	// Feedback decay (how much the previous frame fades)
	const decay = uniform(0.97);

	function resizeHandler(): void {
		scene.setSize(window.innerWidth, window.innerHeight);
	}

	window.addEventListener("resize", resizeHandler);

	let trailEffect: FeedbackTextureNode;
	await scene.build(() => {
		const UV = aspectCorrectedUV(
			"cover",
			scene.aspectUniform,
			"generation"
		);

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
		trailEffect = feedback(
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

	function mousemoveHandler(event: MouseEvent): void {
		const rect = scene.canvasElement.getBoundingClientRect();
		mouseX.value = (event.clientX - rect.left) / rect.width;
		mouseY.value = 1 - (event.clientY - rect.top) / rect.height; // Flip Y for UV coords
	}

	// Track mouse position
	scene.canvasElement.addEventListener("mousemove", mousemoveHandler);

	function touchmoveHandler(event: TouchEvent): void {
		event.preventDefault();
		const touch = event.touches[0];
		const rect = scene.canvasElement.getBoundingClientRect();
		mouseX.value = (touch.clientX - rect.left) / rect.width;
		mouseY.value = 1 - (touch.clientY - rect.top) / rect.height;
	}

	// Touch support
	scene.canvasElement.addEventListener("touchmove", touchmoveHandler);

	container?.appendChild(scene.canvasElement);

	// Info and controls
	const info = document.createElement("div");
	info.style.cssText =
		"position:fixed;top:10px;left:10px;color:white;font-family:monospace;background:rgba(0,0,0,0.5);padding:10px;border-radius:4px;";
	info.innerHTML = `
<strong>FeedbackTexture Demo</strong><br>
Move mouse to draw trails<br>
`;
	container?.appendChild(info);

	// Decay slider
	const decaySlider = new UniformSlider(info, "Decay:", decay, {
		min: 0.8,
		max: 1
	});

	return () => {
		// Remove event listeners
		window.removeEventListener("resize", resizeHandler);
		scene.canvasElement.removeEventListener("mousemove", mousemoveHandler);
		scene.canvasElement.removeEventListener("touchmove", touchmoveHandler);

		decaySlider.dispose();

		// Remove DOM elements
		container?.removeChild(info);
		container?.removeChild(scene.canvasElement);

		// Dispose TSL-2D Kit resources
		trailEffect.dispose();
		scene.dispose();
	};
}
