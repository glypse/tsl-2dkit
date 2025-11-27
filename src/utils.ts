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
