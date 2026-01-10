import type { ShaderNodeFn } from "three/src/nodes/TSL.js";
import { clamp, Fn, mix, vec3, float, type ProxiedObject } from "three/tsl";
import { type Node, Color } from "three/webgpu";
import { oklchToRgb, rgbToOklch } from "./textureColors.js";

/**
 * Samples a color from a gradient using a normalized value. Takes a value
 * (typically between 0 and 1) and looks up the corresponding color from a
 * shader function. The value is automatically clamped to the 0-1 range before
 * sampling.
 *
 * @param value - The normalized lookup value (will be clamped to 0-1)
 * @param gradient - A shader function that takes `t` and returns a color
 * @returns A color node sampled from the gradient
 */
export function colorLookup(
	value: Node,
	gradient: ShaderNodeFn<[ProxiedObject<{ t: Node }>]>
): Node {
	const clampedValue = clamp(value, 0, 1);
	return gradient({ t: clampedValue });
}

/**
 * Creates a procedural gradient shader function that smoothly interpolates
 * between specified color stops. The gradient can interpolate in RGB or OKLCH
 * color space for perceptually uniform results.
 *
 * The resulting shader function is designed to be used with {@link colorLookup}
 * or called directly with a normalized `t` parameter.
 *
 * @example
 *
 * ```ts
 * const grad = gradient(
 * 	[
 * 		{ position: 0, color: "#ff0000" },
 * 		{ position: 0.5, color: "#00ff00" },
 * 		{ position: 1, color: "#0000ff" }
 * 	],
 * 	"oklch"
 * );
 * const color = colorLookup(someValue, grad);
 * ```
 *
 * @param stops - Array of color stops with position (0-1) and color (CSS
 *   string)
 * @param mode - Color interpolation mode
 * @returns A shader function that takes `t` and returns an interpolated color
 */
export function gradient(
	stops: {
		/** Position of the stop, range [0, 1] */
		position: number;
		/** Color of the stop, CSS string */
		color: string;
	}[],
	/** @defaultValue "rgb" */
	mode: "rgb" | "oklch" = "rgb"
): ShaderNodeFn<[ProxiedObject<{ t: Node }>]> {
	// Sort stops by position
	const sortedStops = [...stops].sort((a, b) => a.position - b.position);

	// Convert colors to Three.js Color objects
	const colorStops = sortedStops.map((stop) => ({
		position: stop.position,
		color: new Color(stop.color)
	}));

	return Fn(({ t }: { t: Node }) => {
		// Handle edge cases
		if (colorStops.length === 0) {
			return vec3(0, 0, 0);
		}
		if (colorStops.length === 1) {
			const c = colorStops[0].color;
			return vec3(c.r, c.g, c.b);
		}

		// Find the two stops to interpolate between
		let result: Node = vec3(0, 0, 0);

		for (let i = 0; i < colorStops.length - 1; i++) {
			const stop1 = colorStops[i];
			const stop2 = colorStops[i + 1];

			const inRange = t
				.greaterThanEqual(stop1.position)
				.and(t.lessThanEqual(stop2.position));

			const localT = t
				.sub(stop1.position)
				.div(stop2.position - stop1.position)
				.clamp(0, 1);

			let interpolatedColor: Node;

			if (mode === "oklch") {
				// Convert both colors to OKLCH
				const c1 = stop1.color;
				const c2 = stop2.color;

				const oklch1 = rgbToOklch(
					float(c1.r),
					float(c1.g),
					float(c1.b)
				);
				const oklch2 = rgbToOklch(
					float(c2.r),
					float(c2.g),
					float(c2.b)
				);

				// Interpolate in OKLCH space
				const l = mix(oklch1.x, oklch2.x, localT);
				const c = mix(oklch1.y, oklch2.y, localT);
				const h = mix(oklch1.z, oklch2.z, localT);

				// Convert back to RGB
				interpolatedColor = oklchToRgb(l, c, h);
			} else {
				// RGB interpolation
				const c1 = stop1.color;
				const c2 = stop2.color;

				const rgb1 = vec3(c1.r, c1.g, c1.b);
				const rgb2 = vec3(c2.r, c2.g, c2.b);

				interpolatedColor = mix(rgb1, rgb2, localT);
			}

			// Use conditional to select this segment if in range
			result = inRange.select(interpolatedColor, result);
		}

		// Handle before first stop
		const beforeFirst = t.lessThan(colorStops[0].position);
		const firstColor = colorStops[0].color;
		result = beforeFirst.select(
			vec3(firstColor.r, firstColor.g, firstColor.b),
			result
		);

		// Handle after last stop
		const afterLast = t.greaterThan(
			colorStops[colorStops.length - 1].position
		);
		const lastColor = colorStops[colorStops.length - 1].color;
		result = afterLast.select(
			vec3(lastColor.r, lastColor.g, lastColor.b),
			result
		);

		return result;
	});
}
