import { interpolate, converter, type Mode } from "culori";
import type { ShaderNodeFn } from "three/src/nodes/TSL.js";
import { clamp, texture, vec2, type ProxiedObject } from "three/tsl";
import { type Node, Texture } from "three/webgpu";

/**
 * Samples a color from a gradient using a normalized value. Takes a value
 * (typically between 0 and 1) and looks up the corresponding color from either
 * a texture or a shader function. The value is automatically clamped to the 0-1
 * range before sampling.
 *
 * When using a Texture, it samples horizontally at the vertical center (0.5).
 * When using a shader function, it passes the value as parameter `t`.
 *
 * @param value - The normalized lookup value (will be clamped to 0-1)
 * @param gradient - Either a Texture or a shader function that returns a color
 * @returns A color node sampled from the gradient
 */
export function colorLookup(
	value: Node,
	gradient: ShaderNodeFn<[ProxiedObject<{ t: Node }>]> | Texture
): Node {
	const clampedValue = clamp(value, 0, 1);
	if (gradient instanceof Texture) {
		const sampleUV = vec2(clampedValue, 0.5);
		return texture(gradient, sampleUV);
	} else {
		return gradient({ t: clampedValue });
	}
}

// TODO: Remove/update gradient() to only give a Node instead of a texture.
// This also means removing culori as a dependency
/**
 * Generates a texture containing a smooth gradient between specified color
 * stops. Supports multiple color interpolation modes via the Culori library.
 * For standard RGB gradients, uses native canvas gradients. For other color
 * spaces (HSL, Lab, etc.), performs per-pixel interpolation.
 *
 * The resulting texture can be used with {@link colorLookup} or sampled directly
 * in shaders.
 *
 * @param stops - Array of color stops with position (0-1) and color (CSS
 *   string)
 * @param parameters - Optional configuration for gradient generation
 * @returns A Three.js Texture containing the rendered gradient
 */
export function gradient(
	stops: {
		/** Position of the stop, range [0, 1] */
		position: number;
		/** Color of the stop, CSS string */
		color: string;
	}[],
	parameters: {
		/**
		 * Width of the gradient texture in pixels
		 *
		 * @defaultValue 256
		 */
		width?: number;
		/**
		 * Height of the gradient texture in pixels
		 *
		 * @defaultValue 1
		 */
		height?: number;
		/**
		 * Color interpolation mode from Culori
		 *
		 * @defaultValue "rgb"
		 */
		mode?: Mode;
	} = {}
): Texture {
	const { width = 256, height = 1, mode = "rgb" } = parameters;
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext("2d");
	if (!ctx) throw new Error("2d context not supported");

	if (mode === "rgb") {
		const grad = ctx.createLinearGradient(0, 0, width, 0);
		for (const stop of stops) {
			grad.addColorStop(stop.position, stop.color);
		}
		ctx.fillStyle = grad;
		ctx.fillRect(0, 0, width, height);
	} else {
		const convertRgb = converter("rgb");
		const sortedStops = stops.sort((a, b) => a.position - b.position);
		for (let x = 0; x < width; x++) {
			const t = x / (width - 1);
			let color;
			if (t <= sortedStops[0].position) {
				color = interpolate([sortedStops[0].color], mode)(0);
			} else if (t >= sortedStops[sortedStops.length - 1].position) {
				color = interpolate(
					[sortedStops[sortedStops.length - 1].color],
					mode
				)(0);
			} else {
				for (let i = 0; i < sortedStops.length - 1; i++) {
					if (
						t >= sortedStops[i].position &&
						t <= sortedStops[i + 1].position
					) {
						const localT =
							(t - sortedStops[i].position) /
							(sortedStops[i + 1].position -
								sortedStops[i].position);
						const interp = interpolate(
							[sortedStops[i].color, sortedStops[i + 1].color],
							mode
						);
						color = interp(localT);
						break;
					}
				}
			}
			const rgb = convertRgb(color) ?? { r: 0, g: 0, b: 0 };
			ctx.fillStyle = `rgb(${Math.round(rgb.r * 255).toString()}, ${Math.round(rgb.g * 255).toString()}, ${Math.round(rgb.b * 255).toString()})`;
			ctx.fillRect(x, 0, 1, height);
		}
	}
	const texture = new Texture(canvas);
	texture.needsUpdate = true;
	return texture;
}
