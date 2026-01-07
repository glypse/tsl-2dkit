import { CanvasTexture as ThreeCanvasTexture, TextureNode } from "three/webgpu";
import { vec4, uniform, select, vec2, texture, uv, float } from "three/tsl";
import type { Node } from "three/webgpu";
import { Color } from "three";
import { TSLContext2D } from "../core/TSLContext2D";
import { TSLScene2D } from "../core";
import { TSLPassNode } from "../core/TSLPass";
import { CanvasTexture, type CanvasTextureOptions } from "./CanvasTexture";
import { wrapUV } from "../utils";

type AnchorX = "left" | "center" | "right";
type AnchorY = "descenders" | "baseline" | "middle" | "ascenders";

export type TextTextureOptions = Omit<CanvasTextureOptions, "anchorY"> & {
	anchorX: AnchorX;
	anchorY: AnchorY;
	text: string;
	color: string;
	size: number;
	weight: number;
	fontFamily?: string;
	letterSpacing: string;
	lineHeight: number;
	padding: number;
};

function parseColor(colorStr: string): { r: number; g: number; b: number } {
	const c = new Color(colorStr);
	return { r: c.r, g: c.g, b: c.b };
}

function measureText(parameters: {
	text: string;
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

	measureCtx.font = `${String(parameters.weight)} ${String(parameters.size)}px ${parameters.fontFamily}`;
	measureCtx.letterSpacing = parameters.letterSpacing;

	const lines = parameters.text.split("\n");
	const lineHeightPx = parameters.size * parameters.lineHeight;

	const lineMetrics = lines.map((line) => {
		const metrics = measureCtx.measureText(line);
		return {
			width:
				metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight,
			leftOffset: metrics.actualBoundingBoxLeft,
			ascent: metrics.actualBoundingBoxAscent,
			descent: metrics.actualBoundingBoxDescent
		};
	});

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

export class TextTexture extends CanvasTexture<TextTextureOptions> {
	private ctx: CanvasRenderingContext2D;

	private colorUniform = {
		r: uniform(0),
		g: uniform(0),
		b: uniform(0)
	};

	// Track allocated GPU texture dimensions to detect when recreation is needed
	private gpuTextureWidth = 0;
	private gpuTextureHeight = 0;

	// Cached TextureNode for efficient sampling - allows texture swapping without rebuilding node graph
	private textTexture: TextureNode | null = null;

	// Track if first update has completed (for ready state)
	private firstUpdateComplete = false;

	constructor(parameters?: Partial<TextTextureOptions>) {
		const canvas = document.createElement("canvas");

		super({
			canvas,
			anchorX: parameters?.anchorX ?? "center",
			anchorY: parameters?.anchorY ?? "middle",
			debug: parameters?.debug ?? false
		});

		const ctx = canvas.getContext("2d", { willReadFrequently: false });
		if (!ctx) throw new Error("2d context not supported");

		this.ctx = ctx;

		this.parameters = {
			canvas,
			text: "Lorem ipsum",
			color: "#000000",
			size: 16,
			weight: 500,
			fontFamily: "Arial",
			letterSpacing: "0",
			lineHeight: 1.2,
			anchorX: parameters?.anchorX ?? "center",
			anchorY: parameters?.anchorY ?? "middle",
			padding: 0,
			debug: parameters?.debug ?? false,
			...parameters
		} as TextTextureOptions;
	}

	override sample(inputUV?: Node): Node {
		// Try to register with TSLScene2D, else TSLPassNode
		let context: TSLContext2D | TSLPassNode | null = null;
		let isTSLPass = false;
		try {
			context = TSLScene2D.currentScene;
			isTSLPass = false;
		} catch {
			context = TSLPassNode.currentPass;
			isTSLPass = true;
		}
		if (context) {
			context.registerUpdatableTexture(this);
		}

		let rawUV = inputUV ?? uv();
		// Flip Y in TSLPass context (WebGPU uses Y-down, canvas uses Y-up)
		if (isTSLPass) {
			rawUV = vec2(rawUV.x, rawUV.y.mul(-1));
		}

		let textUV: Node;
		// TSLContext2D has widthUniform/heightUniform
		if (context) {
			const screenPixelX = rawUV.x.mul(context.widthUniform);
			const screenPixelY = rawUV.y.mul(context.heightUniform);
			textUV = vec2(
				screenPixelX.div(this.widthUniform),
				screenPixelY.div(this.heightUniform)
			);
		} else {
			textUV = rawUV;
		}
		return this.sampleTextureWithColor(textUV);
	}

	protected override async update(): Promise<void> {
		const {
			text,
			color,
			size,
			weight,
			fontFamily,
			letterSpacing,
			lineHeight,
			anchorX,
			anchorY,
			padding
		} = this.parameters;

		if (fontFamily) {
			// Wait for fonts to load before measuring/rendering
			await document.fonts.ready;
		}

		const metrics = measureText({
			text,
			size,
			weight,
			fontFamily: fontFamily ?? "Arial",
			letterSpacing,
			lineHeight
		});

		const dpr = window.devicePixelRatio;
		const canvasWidth = metrics.width + padding * 2;
		const canvasHeight = metrics.height + padding * 2;

		const newCanvasWidth = canvasWidth * dpr;
		const newCanvasHeight = canvasHeight * dpr;

		// Check if GPU texture needs recreation due to size change
		const needsTextureRecreation =
			this.gpuTextureWidth !== newCanvasWidth ||
			this.gpuTextureHeight !== newCanvasHeight;

		if (needsTextureRecreation) {
			// Dispose old GPU texture to free resources
			this._texture.dispose();

			// Resize the canvas element (this is the source for CanvasTexture)
			this.sourceCanvas.width = newCanvasWidth;
			this.sourceCanvas.height = newCanvasHeight;

			// Create new CanvasTexture with the resized canvas
			const newTexture = new ThreeCanvasTexture(this.sourceCanvas);
			newTexture.generateMipmaps = false;

			// Update the TextureNode's value to point to new texture
			// This allows the node graph to use the new texture without rebuilding
			if (this.textTexture) {
				this.textTexture.value = newTexture;
			}

			this._texture = newTexture;
			this.applyInterpolation();

			// Track new GPU dimensions
			this.gpuTextureWidth = newCanvasWidth;
			this.gpuTextureHeight = newCanvasHeight;
		}

		// Reset transform and apply DPR scaling
		this.ctx.setTransform(1, 0, 0, 1, 0, 0);
		this.ctx.scale(dpr, dpr);
		this.ctx.font = `${String(weight)} ${String(size)}px ${fontFamily ?? "Arial"}`;
		this.ctx.letterSpacing = letterSpacing;
		this.ctx.textBaseline = "alphabetic";

		this.ctx.fillStyle = "#000000";
		this.ctx.fillRect(0, 0, canvasWidth, canvasHeight);
		this.ctx.fillStyle = "#ffffff";

		for (let i = 0; i < metrics.lines.length; i++) {
			const line = metrics.lines[i];
			const lm = metrics.lineMetrics[i];
			const drawX = lm.leftOffset + padding + 1;
			const drawY =
				padding + 1 + metrics.ascent + i * metrics.lineHeightPx;
			this.ctx.fillText(line, drawX, drawY);
		}

		// Update base CanvasTexture uniforms (_widthUniform, _heightUniform, etc.)
		// by calling the parent update with updated canvas dimensions
		await super.update();

		// Override dimension uniforms with logical (unscaled) dimensions
		// since getWidth/getHeight return unscaled values
		this._widthUniform.value = canvasWidth;
		this._heightUniform.value = canvasHeight;
		this._aspectUniform.value = canvasWidth / canvasHeight;

		// Override specific anchor calculations for text-specific anchor types
		this.anchorOffsetXUniform.value = this.computeAnchorOffsetX(anchorX);
		this.anchorOffsetYUniform.value = this.computeAnchorOffsetY(anchorY);

		const parsedColor = parseColor(color);
		this.colorUniform.r.value = parsedColor.r;
		this.colorUniform.g.value = parsedColor.g;
		this.colorUniform.b.value = parsedColor.b;

		// Mark as ready after first successful update
		if (!this.firstUpdateComplete) {
			this.firstUpdateComplete = true;
			this.markReady();
		}
	}

	private sampleTextureWithColor(inputUV: Node): Node {
		const transformedUV = vec2(
			inputUV.x.add(this.anchorOffsetXUniform),
			inputUV.y.add(this.anchorOffsetYUniform)
		);

		// Apply texture wrapping
		const { uv: wrappedUV, inBounds } = wrapUV(
			transformedUV,
			this.wrapMode
		);

		// Create or reuse TextureNode with wrapped UVs
		this.textTexture ??= texture(this.texture, wrappedUV);
		const sampled = this.textTexture;
		const alpha = sampled.r.pow(2.2);
		const textColor = vec4(
			this.colorUniform.r,
			this.colorUniform.g,
			this.colorUniform.b,
			alpha
		);

		// Debug edges using wrapped UV coordinates
		const nearLeftEdge = wrappedUV.x
			.greaterThanEqual(0)
			.and(wrappedUV.x.lessThan(this.debugLineWidthX));
		const nearRightEdge = wrappedUV.x
			.greaterThan(float(1).sub(this.debugLineWidthX))
			.and(wrappedUV.x.lessThanEqual(1));
		const nearTopEdge = wrappedUV.y
			.greaterThan(float(1).sub(this.debugLineWidthY))
			.and(wrappedUV.y.lessThanEqual(1));
		const nearBottomEdge = wrappedUV.y
			.greaterThanEqual(0)
			.and(wrappedUV.y.lessThan(this.debugLineWidthY));
		const isEdge = nearLeftEdge
			.or(nearRightEdge)
			.or(nearTopEdge)
			.or(nearBottomEdge);

		return select(
			inBounds,
			select(
				isEdge.and(this.debugUniform.greaterThan(0)),
				textColor.rgb,
				textColor
			),
			vec4(0, 0, 0, 0)
		);
	}

	protected override computeAnchorOffsetY(anchorY: string): number {
		// For text-specific anchor types, we need extra context
		const canvasHeight = this.sourceCanvas.height / window.devicePixelRatio;
		const padding = this.parameters.padding;

		// Get descent from current text metrics
		const metrics = measureText({
			text: this.parameters.text,
			size: this.parameters.size,
			weight: this.parameters.weight,
			fontFamily: this.parameters.fontFamily ?? "Arial",
			letterSpacing: this.parameters.letterSpacing,
			lineHeight: this.parameters.lineHeight
		});
		const descent = metrics.descent;

		const totalH = canvasHeight;
		const extraPixel = 1 / totalH;
		const paddingRatio = (padding + 1) / totalH;
		const descentRatio = descent / totalH;

		switch (anchorY) {
			case "descenders":
				return paddingRatio;
			case "baseline":
				return paddingRatio + descentRatio;
			case "ascenders":
				return 1 - paddingRatio - extraPixel;
			case "middle":
			default:
				return 0.5;
		}
	}

	protected override getWidth(): number {
		return this.gpuTextureWidth / window.devicePixelRatio;
	}

	protected override getHeight(): number {
		return this.gpuTextureHeight / window.devicePixelRatio;
	}
}
