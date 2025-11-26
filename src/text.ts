import { CanvasTexture } from "three/webgpu";
import {
	texture,
	vec4,
	vec3,
	vec2,
	uniform,
	float,
	select,
	uv
} from "three/tsl";
import type { Node } from "three/webgpu";
import { Color } from "three";
import { Canvas2D } from "./core/scene";

/** Parse a CSS color string to RGB values (0-1) */
function parseColor(colorStr: string): { r: number; g: number; b: number } {
	const c = new Color(colorStr);
	return { r: c.r, g: c.g, b: c.b };
}

/**
 * Measures text metrics using a temporary canvas context.
 * Returns actual pixel dimensions and font metrics.
 */
function measureText(opts: {
	string: string;
	size: number;
	weight: number;
	fontFamily: string;
	letterSpacing: string;
	lineHeight: number;
}): {
	width: number;
	height: number;
	ascent: number;
	descent: number;
	leftOffset: number;
	lineHeightPx: number;
	lines: string[];
	lineMetrics: {
		width: number;
		leftOffset: number;
		ascent: number;
		descent: number;
	}[];
} {
	const measureCanvas = document.createElement("canvas");
	const measureCtx = measureCanvas.getContext("2d");
	if (!measureCtx) throw new Error("2d context not supported");

	measureCtx.font = `${String(opts.weight)} ${String(opts.size)}px ${opts.fontFamily}`;
	measureCtx.letterSpacing = opts.letterSpacing;

	const lines = opts.string.split("\n");
	const lineHeightPx = opts.size * opts.lineHeight;

	// Measure each line using actual bounding box metrics
	const lineMetrics = lines.map((line) => {
		const metrics = measureCtx.measureText(line);
		return {
			// actualBoundingBoxLeft is positive when text extends left of the origin
			// actualBoundingBoxRight is positive when text extends right of the origin
			width:
				metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight,
			leftOffset: metrics.actualBoundingBoxLeft,
			ascent: metrics.actualBoundingBoxAscent,
			descent: metrics.actualBoundingBoxDescent
		};
	});

	// Find max dimensions across all lines
	let maxWidth = 0;
	let maxLeftOffset = 0;
	let maxAscent = 0;
	let maxDescent = 0;

	for (const lm of lineMetrics) {
		maxWidth = Math.max(maxWidth, lm.width);
		maxLeftOffset = Math.max(maxLeftOffset, lm.leftOffset);
		maxAscent = Math.max(maxAscent, lm.ascent);
		maxDescent = Math.max(maxDescent, lm.descent);
	}

	// Total height: first line ascent + (n-1) * lineHeight + last line descent
	const totalHeight =
		lines.length === 1
			? maxAscent + maxDescent
			: maxAscent + (lines.length - 1) * lineHeightPx + maxDescent;

	return {
		width: Math.ceil(maxWidth),
		height: Math.ceil(totalHeight),
		ascent: maxAscent,
		descent: maxDescent,
		leftOffset: maxLeftOffset,
		lineHeightPx,
		lines,
		lineMetrics
	};
}

/**
 * Creates a text texture and returns the sampled color Node.
 */
export function text(
	opts?: {
		/** The text string to render (supports multi-line with \n) */
		string?: string;
		/** Text color (CSS color string) */
		color?: string;
		/** Font size in pixels */
		size?: number;
		/** Font weight (100-900) */
		weight?: number;
		/** Font family name */
		fontFamily?: string;
		/** Letter spacing (CSS value, e.g., "-0.05em") */
		letterSpacing?: string;
		/** Line height multiplier */
		lineHeight?: number;
		/** Horizontal anchor point - where UV (0, y) is horizontally */
		anchorX?: "left" | "center" | "right";
		/** Vertical anchor point - where UV (x, 0) is vertically */
		anchorY?: "descenders" | "baseline" | "middle" | "ascenders";
		/** Optional padding around the text in pixels */
		padding?: number;
		/** Show debug outline around texture bounds */
		debug?: boolean;
	},
	/** Optional function to transform screen UVs (in canvas space 0-1) before sampling */
	uvTransform?: (screenUV: Node) => Node
) {
	const dpr = window.devicePixelRatio;

	const string = opts?.string ?? "Lorem ipsum";
	const color = opts?.color ?? "#000000";
	const size = opts?.size ?? 16;
	const weight = opts?.weight ?? 500;
	const fontFamily = opts?.fontFamily ?? "Arial";
	const letterSpacing = opts?.letterSpacing ?? "0";
	const lineHeight = opts?.lineHeight ?? 1.2;
	const anchorX = opts?.anchorX ?? "center";
	const anchorY = opts?.anchorY ?? "middle";
	const padding = opts?.padding ?? 0;
	const debug = opts?.debug ?? false;

	// Measure text dimensions
	const metrics = measureText({
		string,
		size,
		weight,
		fontFamily,
		letterSpacing,
		lineHeight
	});

	// Create canvas with exact size needed (+ padding)
	// Add 1px extra to avoid subpixel clipping
	const canvasWidth = metrics.width + padding * 2 + 2;
	const canvasHeight = metrics.height + padding * 2 + 2;

	const canvas = document.createElement("canvas");
	canvas.width = canvasWidth * dpr;
	canvas.height = canvasHeight * dpr;

	const ctx = canvas.getContext("2d", { willReadFrequently: false });
	if (!ctx) throw new Error("2d context not supported");

	ctx.scale(dpr, dpr);
	ctx.font = `${String(weight)} ${String(size)}px ${fontFamily}`;
	ctx.letterSpacing = letterSpacing;
	ctx.textBaseline = "alphabetic"; // Use alphabetic baseline for precise positioning

	// Fill with black background, then draw white text
	// This gives us proper antialiasing in the luminance channel
	// which we'll use as an alpha mask for the actual color
	ctx.fillStyle = "#000000";
	ctx.fillRect(0, 0, canvasWidth, canvasHeight);
	ctx.fillStyle = "#ffffff";

	// Draw each line with precise positioning using actual bounding box
	// We position text so that the actual ink is within our measured bounds
	for (let i = 0; i < metrics.lines.length; i++) {
		const line = metrics.lines[i];
		const lm = metrics.lineMetrics[i];

		// X position: offset by leftOffset + padding + 1 (for the extra pixel)
		// This ensures text that extends left of origin is not clipped
		const drawX = lm.leftOffset + padding + 1;

		// Y position: for first line, place baseline at padding + ascent + 1
		// For subsequent lines, add lineHeight
		const drawY = padding + 1 + metrics.ascent + i * metrics.lineHeightPx;

		ctx.fillText(line, drawX, drawY);
	}

	// Create texture with proper filtering for crisp text
	const canvasTexture = new CanvasTexture(canvas);
	canvasTexture.generateMipmaps = false;
	canvasTexture.needsUpdate = true;

	// Calculate UV offset based on anchor
	// UV space: (0,0) is bottom-left, (1,1) is top-right in WebGL
	// But canvas: (0,0) is top-left
	// We want to transform input UV so that (0,0) lands on the anchor point

	let anchorOffsetX: number;
	switch (anchorX) {
		case "left":
			anchorOffsetX = 0;
			break;
		case "right":
			anchorOffsetX = 1;
			break;
		case "center":
		default:
			anchorOffsetX = 0.5;
			break;
	}

	// For vertical, we need to account for font metrics
	// Canvas draws from top, UV (0,0) is at bottom-left
	// After texture flip, UV y=0 is at bottom of texture (descenders)
	let anchorOffsetY: number;
	const totalH = canvasHeight;
	const extraPixel = 1 / totalH; // Account for the extra pixel we added
	const paddingRatio = (padding + 1) / totalH;
	const descentRatio = metrics.descent / totalH;

	switch (anchorY) {
		case "descenders":
			// Bottom of text (including descenders) = UV y = 0 (but need to flip)
			// In flipped coords, this is at the bottom
			anchorOffsetY = paddingRatio;
			break;
		case "baseline":
			// Baseline is above descenders
			anchorOffsetY = paddingRatio + descentRatio;
			break;
		case "ascenders":
			// Top of text (ascenders)
			anchorOffsetY = 1 - paddingRatio - extraPixel;
			break;
		case "middle":
		default:
			anchorOffsetY = 0.5;
			break;
	}

	const widthUniform = uniform(canvasWidth);
	const heightUniform = uniform(canvasHeight);
	const anchorOffsetXUniform = uniform(anchorOffsetX);
	const anchorOffsetYUniform = uniform(anchorOffsetY);
	const debugUniform = uniform(debug ? 1 : 0);
	const debugLineWidthX = uniform(1 / canvasWidth);
	const debugLineWidthY = uniform(1 / canvasHeight);

	// Parse the user's color and create uniforms
	const parsedColor = parseColor(color);
	const colorUniform = vec3(
		uniform(parsedColor.r),
		uniform(parsedColor.g),
		uniform(parsedColor.b)
	);

	function sample(inputUV: Node) {
		// Transform UV: shift so anchor point is at (0, 0)
		// Then sample. Input UV (0,0) should map to anchor position in texture
		const transformedUV = vec2(
			inputUV.x.add(anchorOffsetXUniform),
			inputUV.y.add(anchorOffsetYUniform)
		);

		// Check if UV is within texture bounds (0-1)
		const inBoundsX = transformedUV.x
			.greaterThanEqual(0)
			.and(transformedUV.x.lessThanEqual(1));
		const inBoundsY = transformedUV.y
			.greaterThanEqual(0)
			.and(transformedUV.y.lessThanEqual(1));
		const inBounds = inBoundsX.and(inBoundsY);

		// Sample texture - we rendered white on black, so luminance = alpha
		const sampled = texture(canvasTexture, transformedUV);
		// Use the red channel (or any, since it's grayscale) as alpha
		// Apply gamma correction manually for proper blending (sRGBTransferEOTF expects vec3)
		const alpha = sampled.r.pow(2.2);
		// Apply the user's color with the computed alpha
		const textColor = vec4(
			colorUniform.x,
			colorUniform.y,
			colorUniform.z,
			alpha
		);

		// Debug outline: check if near edge
		const nearLeftEdge = transformedUV.x
			.greaterThanEqual(0)
			.and(transformedUV.x.lessThan(debugLineWidthX));
		const nearRightEdge = transformedUV.x
			.greaterThan(float(1).sub(debugLineWidthX))
			.and(transformedUV.x.lessThanEqual(1));
		const nearTopEdge = transformedUV.y
			.greaterThan(float(1).sub(debugLineWidthY))
			.and(transformedUV.y.lessThanEqual(1));
		const nearBottomEdge = transformedUV.y
			.greaterThanEqual(0)
			.and(transformedUV.y.lessThan(debugLineWidthY));
		const isEdge = nearLeftEdge
			.or(nearRightEdge)
			.or(nearTopEdge)
			.or(nearBottomEdge);

		// Debug color (outline)
		const debugColor = vec4(0, 1, 0, 1);

		// Return transparent if outside bounds, debug color if on edge and debug enabled, otherwise text
		const result = select(
			inBounds,
			select(
				isEdge.and(debugUniform.greaterThan(0)),
				debugColor,
				textColor
			),
			vec4(0, 0, 0, 0)
		);

		return result;
	}

	/**
	 * Converts screen UV to text UV coordinates.
	 * Screen UV is in canvas space (0-1), text UV is in texture space (0-1).
	 */
	function screenToTextUV(screenUV: Node, canvas: Canvas2D): Node {
		// Convert screen UV to pixels, then scale to text UV
		const screenPixelX = screenUV.x.mul(canvas.widthUniform);
		const screenPixelY = screenUV.y.mul(canvas.heightUniform);

		// Scale to text UV space
		const textUV = vec2(
			screenPixelX.div(widthUniform),
			screenPixelY.div(heightUniform)
		);

		return textUV;
	}

	// Auto-detect canvas
	const targetCanvas = Canvas2D.currentCanvas;
	if (!targetCanvas) {
		throw new Error(
			"No active Canvas2D found. Make sure you're calling this within a canvas.draw() callback."
		);
	}

	// Get screen UV and apply user's transform in screen/canvas space
	const screenUV = uv();
	const transformedScreenUV = uvTransform
		? uvTransform(screenUV)
		: screenUV.sub(vec2(0.5, 0.5));

	// Convert to text UV space after the transform
	const textUV = screenToTextUV(transformedScreenUV, targetCanvas);
	return sample(textUV);
}
