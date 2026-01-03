import { float, uv, vec2 } from "three/tsl";
import { Node } from "three/webgpu";
import { Canvas2D } from "./core";

export function getAspectCorrectedUV(
	fit: "cover" | "contain" | "stretch" = "cover"
): Node {
	const UV = uv();
	const canvas = Canvas2D.currentCanvas;
	const canvasSize = vec2(canvas.widthUniform, canvas.heightUniform);

	if (fit == "stretch") {
		return UV;
	}

	const aspectRatio = canvasSize.x.div(canvasSize.y);

	// Center the UVs around (0.5, 0.5)
	const centeredUV = UV.sub(vec2(0.5, 0.5));

	let scaleX: Node;
	let scaleY: Node;

	if (fit == "cover") {
		scaleX = aspectRatio.lessThan(1).select(aspectRatio, float(1));
		scaleY = aspectRatio
			.greaterThan(1)
			.select(float(1).div(aspectRatio), float(1));
	} else {
		scaleX = aspectRatio.greaterThan(1).select(aspectRatio, float(1));
		scaleY = aspectRatio
			.lessThan(1)
			.select(float(1).div(aspectRatio), float(1));
	}

	const correctedUV = vec2(
		centeredUV.x.mul(scaleX),
		centeredUV.y.mul(scaleY)
	).add(vec2(0.5, 0.5));

	return correctedUV;
}

/**
 * Convert UV coordinates (0-1) to screen space pixel coordinates
 * @param uv - UV coordinates as vec2(x, y) where (0,0) is bottom-left
 * @param screenSize - Screen size as vec2(width, height) in pixels
 * @returns Pixel coordinates as vec2(x, y)
 */
export function uvToScreenSpace(uv: Node, screenSize: Node): Node {
	return vec2(uv.x.mul(screenSize.x), uv.y.mul(screenSize.y));
}

/**
 * Convert screen space pixel coordinates to UV coordinates (0-1)
 * @param pixelPos - Pixel coordinates as vec2(x, y)
 * @param screenSize - Screen size as vec2(width, height) in pixels
 * @returns UV coordinates as vec2(x, y) where (0,0) is bottom-left
 */
export function screenSpaceToUV(pixelPos: Node, screenSize: Node): Node {
	return vec2(pixelPos.x.div(screenSize.x), pixelPos.y.div(screenSize.y));
}

export type WrapMode = "clamp" | "repeat" | "mirror" | "edge";

/**
 * Apply texture wrapping to UV coordinates
 * @param uv - Input UV coordinates
 * @param mode - Wrapping mode:
 *   - "clamp-to-border": UVs outside 0-1 are out of bounds (default)
 *   - "repeat": Tiles the texture infinitely
 *   - "mirror": Tiles with alternating mirroring
 *   - "clamp-to-edge": Clamps to 0-1 range, stretching edge pixels
 * @returns Object with wrapped UV and inBounds flag
 */
export function wrapUV(uv: Node, mode: WrapMode): { uv: Node; inBounds: Node } {
	const x = uv.x;
	const y = uv.y;

	if (mode === "clamp") {
		// Original behavior - check bounds
		const inBoundsX = x.greaterThanEqual(0).and(x.lessThanEqual(1));
		const inBoundsY = y.greaterThanEqual(0).and(y.lessThanEqual(1));
		const inBounds = inBoundsX.and(inBoundsY);
		return { uv: vec2(x, y), inBounds };
	} else if (mode === "repeat") {
		// Tile infinitely: fract(uv)
		const wrappedX = x.fract();
		const wrappedY = y.fract();
		return { uv: vec2(wrappedX, wrappedY), inBounds: float(1) };
	} else if (mode === "mirror") {
		// Mirrored repeat: 1 - abs((uv % 2) - 1)
		const wrappedX = float(1).sub(x.mul(0.5).fract().mul(2).sub(1).abs());
		const wrappedY = float(1).sub(y.mul(0.5).fract().mul(2).sub(1).abs());
		return { uv: vec2(wrappedX, wrappedY), inBounds: float(1) };
	} else {
		// edge: clamp(uv, 0, 1)
		const clampedX = x.clamp(0, 1);
		const clampedY = y.clamp(0, 1);
		return { uv: vec2(clampedX, clampedY), inBounds: float(1) };
	}
}
