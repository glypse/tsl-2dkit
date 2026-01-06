import { CanvasTexture, TextureNode } from "three/webgpu";
import { texture, vec4, vec2, uniform, float, select, uv } from "three/tsl";
import type { Node, UniformNode } from "three/webgpu";
import { Color } from "three";
import { TSLScene2D } from "../core";
import { UpdatableTexture } from "./UpdatableTexture";
import { wrapUV } from "../utils";

type AnchorX = "left" | "center" | "right";
type AnchorY = "descenders" | "baseline" | "middle" | "ascenders";

export type TextTextureOptions = {
	text: string;
	color: string;
	size: number;
	weight: number;
	fontFamily?: string;
	letterSpacing: string;
	lineHeight: number;
	anchorX: AnchorX;
	anchorY: AnchorY;
	padding: number;
	debug: boolean;
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

export class TextTexture extends UpdatableTexture {
	parameters: TextTextureOptions;

	private canvas: HTMLCanvasElement;
	private ctx: CanvasRenderingContext2D;

	private _widthUniform = uniform(0);
	private _heightUniform = uniform(0);
	private _aspectUniform = uniform(1);
	private anchorOffsetXUniform = uniform(0.5);
	private anchorOffsetYUniform = uniform(0.5);
	private debugUniform = uniform(0);
	private debugLineWidthX = uniform(0);
	private debugLineWidthY = uniform(0);

	private colorUniform = {
		r: uniform(0),
		g: uniform(0),
		b: uniform(0)
	};

	// Track allocated GPU texture dimensions to detect when recreation is needed
	private gpuTextureWidth = 0;
	private gpuTextureHeight = 0;

	// Cached TextureNode for efficient sampling - allows texture swapping without rebuilding node graph
	private textureNode: TextureNode | null = null;

	constructor(parameters?: Partial<TextTextureOptions>) {
		const canvas = document.createElement("canvas");
		const canvasTexture = new CanvasTexture(canvas);
		canvasTexture.generateMipmaps = false;

		super(canvasTexture);

		const ctx = canvas.getContext("2d", { willReadFrequently: false });
		if (!ctx) throw new Error("2d context not supported");

		this.canvas = canvas;
		this.ctx = ctx;

		this.parameters = {
			text: "Lorem ipsum",
			color: "#000000",
			size: 16,
			weight: 500,
			fontFamily: "Arial",
			letterSpacing: "0",
			lineHeight: 1.2,
			anchorX: "center",
			anchorY: "middle",
			padding: 0,
			debug: false,
			...parameters
		};
	}

	sample(inputUV?: Node): Node {
		const canvas = TSLScene2D.currentScene;

		// Register for per-frame updates once sampling is requested.
		canvas.registerUpdatableTexture(this);

		const rawUV = inputUV ?? uv();
		const textUV = this.screenToTextUV(rawUV, canvas);
		return this.sampleTexture(textUV);
	}

	protected async update(): Promise<void> {
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
			padding,
			debug
		} = this.parameters;

		if (fontFamily) {
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
			this.canvas.width = newCanvasWidth;
			this.canvas.height = newCanvasHeight;

			// Create new CanvasTexture with the resized canvas
			const newTexture = new CanvasTexture(this.canvas);
			newTexture.generateMipmaps = false;

			// Update the TextureNode's value to point to new texture
			// This allows the node graph to use the new texture without rebuilding
			if (this.textureNode) {
				this.textureNode.value = newTexture;
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

		this._widthUniform.value = canvasWidth;
		this._heightUniform.value = canvasHeight;
		this._aspectUniform.value = canvasWidth / canvasHeight;
		this.debugUniform.value = debug ? 1 : 0;
		this.debugLineWidthX.value = 1 / canvasWidth;
		this.debugLineWidthY.value = 1 / canvasHeight;

		this.anchorOffsetXUniform.value = this.computeAnchorOffsetX(anchorX);
		this.anchorOffsetYUniform.value = this.computeAnchorOffsetY(
			anchorY,
			canvasHeight,
			padding,
			metrics.descent
		);

		const parsedColor = parseColor(color);
		this.colorUniform.r.value = parsedColor.r;
		this.colorUniform.g.value = parsedColor.g;
		this.colorUniform.b.value = parsedColor.b;
	}

	private sampleTexture(inputUV: Node): Node {
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
		this.textureNode ??= texture(this.texture, wrappedUV);
		const sampled = this.textureNode;
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

	private screenToTextUV(screenUV: Node, canvas: TSLScene2D): Node {
		const screenPixelX = screenUV.x.mul(canvas.widthUniform);
		const screenPixelY = screenUV.y.mul(canvas.heightUniform);

		return vec2(
			screenPixelX.div(this._widthUniform),
			screenPixelY.div(this._heightUniform)
		);
	}

	private computeAnchorOffsetX(anchorX: AnchorX): number {
		switch (anchorX) {
			case "left":
				return 0;
			case "right":
				return 1;
			case "center":
			default:
				return 0.5;
		}
	}

	private computeAnchorOffsetY(
		anchorY: AnchorY,
		canvasHeight: number,
		padding: number,
		descent: number
	): number {
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

	protected getWidth(): number {
		return this.gpuTextureWidth / window.devicePixelRatio;
	}

	protected getHeight(): number {
		return this.gpuTextureHeight / window.devicePixelRatio;
	}

	protected getAspectRatio(): number {
		const h = this.getHeight();
		return h > 0 ? this.getWidth() / h : 1;
	}

	/**
	 * Get a uniform node representing the texture's width in pixels.
	 * This uniform automatically updates when the text changes.
	 * Use this in your node graph for reactive width handling.
	 */
	get widthUniform(): UniformNode<number> {
		return this._widthUniform;
	}

	/**
	 * Get a uniform node representing the texture's height in pixels.
	 * This uniform automatically updates when the text changes.
	 * Use this in your node graph for reactive height handling.
	 */
	get heightUniform(): UniformNode<number> {
		return this._heightUniform;
	}

	/**
	 * Get a uniform node representing the texture's aspect ratio (width/height).
	 * This uniform automatically updates when the text changes.
	 * Use this in your node graph for reactive aspect ratio handling.
	 */
	get aspectUniform(): UniformNode<number> {
		return this._aspectUniform;
	}
}
