import { float, uv, vec2 } from "three/tsl";
import { type Node } from "three/webgpu";
import { TSLScene2D } from "./core";

/**
 * Aspect-correct UV coordinates. Has two modes:
 *
 * - "sampling": For sampling external textures (MediaTexture, images, etc.) -
 *   expands UV range
 * - "generation": For generated content (voronoi, noise, etc.) - compresses UV
 *   coordinates
 *
 * @param fit - How to fit the content
 * @default "cover"
 * @param aspectRatio - Target aspect ratio (width/height). If omitted, uses canvas aspect ratio
 * @param mode - "sampling" for external textures, "generation" for generated content
 * @default "sampling"
 * @returns Aspect-corrected UV coordinates as a Node
 */
export function aspectCorrectedUV(
	fit: "cover" | "contain" | "stretch" = "cover",
	aspectRatio?: Node,
	mode: "sampling" | "generation" = "sampling"
): Node {
	const UV = uv();

	if (fit === "stretch") return UV;

	const canvas = TSLScene2D.currentScene;

	// Use provided aspect ratio, or fall back to canvas aspect ratio
	const canvasAspectRatio = canvas.aspectUniform;
	const targetAspectRatio = aspectRatio ?? canvasAspectRatio;

	// Center the UVs around (0.5, 0.5)
	const centeredUV = UV.sub(vec2(0.5, 0.5));

	let scaleX: Node;
	let scaleY: Node;
	let operation: (coord: Node, scale: Node) => Node;

	switch (mode) {
		case "sampling": {
			let xCondition: Node;
			let yCondition: Node;

			switch (fit) {
				case "cover":
					xCondition = canvasAspectRatio.lessThan(targetAspectRatio);
					yCondition =
						canvasAspectRatio.greaterThan(targetAspectRatio);
					break;
				case "contain":
					xCondition =
						canvasAspectRatio.greaterThan(targetAspectRatio);
					yCondition = canvasAspectRatio.lessThan(targetAspectRatio);
					break;
			}

			scaleX = xCondition.select(
				targetAspectRatio.div(canvasAspectRatio),
				float(1)
			);
			scaleY = yCondition.select(
				canvasAspectRatio.div(targetAspectRatio),
				float(1)
			);
			operation = (coord: Node, scale: Node) => coord.div(scale);
			break;
		}
		case "generation": {
			let xCondition: Node;
			let yCondition: Node;

			switch (fit) {
				case "cover":
					xCondition = targetAspectRatio.lessThan(1);
					yCondition = targetAspectRatio.greaterThan(1);
					break;
				case "contain":
					xCondition = targetAspectRatio.greaterThan(1);
					yCondition = targetAspectRatio.lessThan(1);
					break;
			}

			scaleX = xCondition.select(targetAspectRatio, float(1));
			scaleY = yCondition.select(
				float(1).div(targetAspectRatio),
				float(1)
			);
			operation = (coord: Node, scale: Node) => coord.mul(scale);
			break;
		}
	}

	// Sampling divides, generation multiplies
	const correctedUV = vec2(
		operation(centeredUV.x, scaleX),
		operation(centeredUV.y, scaleY)
	);

	return correctedUV.add(vec2(0.5, 0.5));
}

/** Texture wrapping mode for UV coordinates outside the 0-1 range. */
export type WrapMode = "clamp" | "repeat" | "mirror" | "edge";

/**
 * Apply texture wrapping to UV coordinates
 *
 * @param uv - Input UV coordinates
 * @param mode - Wrapping mode:
 *
 *   - "clamp": UVs outside 0-1 are out of bounds (default)
 *   - "repeat": Tiles the texture infinitely
 *   - "mirror": Tiles with alternating mirroring
 *   - "edge": Clamps to 0-1 range, stretching edge pixels
 *
 * @returns Object with wrapped UV and inBounds flag
 */
export function wrapUV(uv: Node, mode: WrapMode): { uv: Node; inBounds: Node } {
	const x = uv.x;
	const y = uv.y;

	switch (mode) {
		case "clamp": {
			// Original behavior - check bounds
			const inBoundsX = x.greaterThanEqual(0).and(x.lessThanEqual(1));
			const inBoundsY = y.greaterThanEqual(0).and(y.lessThanEqual(1));
			const inBounds = inBoundsX.and(inBoundsY);
			return { uv: vec2(x, y), inBounds };
		}
		case "repeat": {
			// Tile infinitely: fract(uv)
			const wrappedX = x.fract();
			const wrappedY = y.fract();
			return { uv: vec2(wrappedX, wrappedY), inBounds: float(1) };
		}
		case "mirror": {
			// Mirrored repeat: 1 - abs((uv % 2) - 1)
			const wrappedX = float(1).sub(
				x.mul(0.5).fract().mul(2).sub(1).abs()
			);
			const wrappedY = float(1).sub(
				y.mul(0.5).fract().mul(2).sub(1).abs()
			);
			return { uv: vec2(wrappedX, wrappedY), inBounds: float(1) };
		}
		case "edge": {
			// edge: clamp(uv, 0, 1)
			const clampedX = x.clamp(0, 1);
			const clampedY = y.clamp(0, 1);
			return { uv: vec2(clampedX, clampedY), inBounds: float(1) };
		}
	}
}
