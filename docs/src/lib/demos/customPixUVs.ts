import { lerp } from "three/src/math/MathUtils.js";
import { uniform, floor, time, sin, color, mix, uv, vec2 } from "three/tsl";
import { TSLScene2D, TextTexture } from "tsl-2dkit";

/**
 * Gets the mouse position on the element in a 0-1 range.
 *
 * @param element - The element to get the position relative to.
 * @param event - The mouse event containing the client coordinates.
 * @returns An object containing the relative mouse position. - `x`: The
 *   horizontal position as a fraction of the element width (0 to 1). - `y`: The
 *   vertical position as a fraction of the element height (0 to 1).
 */
function getRelativeMousePosition(
	element: HTMLElement,
	event: MouseEvent
): { x: number; y: number } {
	const rect = element.getBoundingClientRect();
	return {
		x: (event.clientX - rect.left) / rect.width,
		y: (event.clientY - rect.top) / rect.height
	};
}

/**
 * Custom pixelated UVs demo
 *
 * Recreation of the first kinetic typography tutorial by Tim Rodenbröker.
 * This recreation is what started this library!
 *
 * @returns A cleanup function to dispose of all resources
 */
export default async function (): Promise<() => void> {
	const container = document.getElementById("demo-container");

	const scene = new TSLScene2D(window.innerWidth, window.innerHeight, {
		stats: true,
		antialias: "none",
		renderMode: "continuous" // Uses time-based animation
	});

	const mouse = { x: 0.5, y: 0.5 };

	const textTexture = new TextTexture({
		text: "a",
		size: Math.min(window.innerWidth, window.innerHeight),
		// Initial value, not reactive value
		weight: lerp(200, 800, mouse.y),
		color: "#00ff00",
		fontFamily: "Fustat",
		debug: true,
		padding: 0
	});

	function resizeHandler(): void {
		scene.setSize(window.innerWidth, window.innerHeight);
		textTexture.parameters.size = Math.min(
			window.innerWidth,
			window.innerHeight
		);
		textTexture.needsUpdate = true;
	}

	window.addEventListener("resize", resizeHandler);

	const tileAmount = uniform(8);
	const speed = uniform(1);

	// Initial value, not reactive value
	const waveStrength = uniform(lerp(0, 0.1, mouse.x));

	let previousMouseY = 0.5;

	await scene.build(() => {
		const UV = uv();

		const tileX = floor(UV.x.mul(tileAmount).mul(scene.aspectUniform));
		const tileY = floor(UV.y.mul(tileAmount));

		const wave = sin(time.mul(speed).add(tileX.add(tileY))).mul(
			waveStrength
		);

		const textSample = textTexture.sample(
			uv().sub(vec2(0.5, 0.5)).add(vec2(wave, 0))
		);

		const compositedText = mix(
			color("#0000ff"),
			textSample.rgb,
			textSample.a
		);

		return compositedText;
	});

	function mousemoveHandler(event: MouseEvent): void {
		const mouse = getRelativeMousePosition(scene.canvasElement, event);
		waveStrength.value = lerp(0, 0.1, mouse.x);

		if (mouse.y !== previousMouseY) {
			textTexture.parameters.weight = lerp(200, 800, mouse.y);
			textTexture.needsUpdate = true;
			previousMouseY = mouse.y;
		}
	}

	scene.canvasElement.addEventListener("mousemove", mousemoveHandler);

	container?.appendChild(scene.canvasElement);

	return () => {
		// Remove event listeners
		window.removeEventListener("resize", resizeHandler);
		scene.canvasElement.removeEventListener("mousemove", mousemoveHandler);

		// Remove DOM elements
		container?.removeChild(scene.canvasElement);

		// Dispose TSL-2D Kit resources
		textTexture.dispose();
		scene.dispose();
	};
}
