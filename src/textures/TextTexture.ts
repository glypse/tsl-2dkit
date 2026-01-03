import { CanvasTexture, TextureNode } from "three/webgpu";
import { texture, vec4, vec2, uniform, float, select, uv } from "three/tsl";
import type { Node } from "three/webgpu";
import { Color, LinearFilter } from "three";
import { Canvas2D } from "../core/scene";
import { DynamicTexture } from "./DynamicTexture";

type AnchorX = "left" | "center" | "right";
type AnchorY = "descenders" | "baseline" | "middle" | "ascenders";

export type TextTextureOptions = {
	string: string;
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

function measureText(opts: {
	string: string;
	size: number;
	weight: number;
	fontFamily: string;
	letterSpacing: string;
	lineHeight: number;
}) {
	const measureCanvas = document.createElement("canvas");
	const measureCtx = measureCanvas.getContext("2d");
	if (!measureCtx) throw new Error("2d context not supported");

	measureCtx.font = `${String(opts.weight)} ${String(opts.size)}px ${opts.fontFamily}`;
	measureCtx.letterSpacing = opts.letterSpacing;

	const lines = opts.string.split("\n");
	const lineHeightPx = opts.size * opts.lineHeight;

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

export class TextTexture extends DynamicTexture {
	config: TextTextureOptions;

	private canvas: HTMLCanvasElement;
	private ctx: CanvasRenderingContext2D;

	private widthUniform = uniform(0);
	private heightUniform = uniform(0);
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

	constructor(opts?: Partial<TextTextureOptions>) {
		const canvas = document.createElement("canvas");
		const canvasTexture = new CanvasTexture(canvas);
		canvasTexture.generateMipmaps = false;

		super(canvasTexture);

		const ctx = canvas.getContext("2d", { willReadFrequently: false });
		if (!ctx) throw new Error("2d context not supported");

		this.canvas = canvas;
		this.ctx = ctx;

		this.config = {
			string: "Lorem ipsum",
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
			...opts
		};
	}

	sample(inputUV?: Node): Node {
		const canvas = Canvas2D.currentCanvas;

		// Register for per-frame updates once sampling is requested.
		canvas.registerDynamicTexture(this);

		const rawUV = inputUV ?? uv();
		const textUV = this.screenToTextUV(rawUV, canvas);
		return this.sampleTexture(textUV);
		/* return this.sampleTexture(rawUV); */
	}

	protected async update(): Promise<void> {
		const {
			string,
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
		} = this.config;

		if (fontFamily) {
			await document.fonts.ready;
		}

		const metrics = measureText({
			string,
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
			newTexture.minFilter = LinearFilter;
			newTexture.magFilter = LinearFilter;

			// Update the TextureNode's value to point to new texture
			// This allows the node graph to use the new texture without rebuilding
			if (this.textureNode) {
				this.textureNode.value = newTexture;
			}

			// Track new GPU dimensions
			this.gpuTextureWidth = newCanvasWidth;
			this.gpuTextureHeight = newCanvasHeight;
		}

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

		this.widthUniform.value = canvasWidth;
		this.heightUniform.value = canvasHeight;
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

		const inBoundsX = transformedUV.x
			.greaterThanEqual(0)
			.and(transformedUV.x.lessThanEqual(1));
		const inBoundsY = transformedUV.y
			.greaterThanEqual(0)
			.and(transformedUV.y.lessThanEqual(1));
		const inBounds = inBoundsX.and(inBoundsY);

		// Create or reuse TextureNode - this allows texture swapping without rebuilding node graph
		this.textureNode ??= texture(this.texture, transformedUV);
		const sampled = this.textureNode;
		const alpha = sampled.r.pow(2.2);
		const textColor = vec4(
			this.colorUniform.r,
			this.colorUniform.g,
			this.colorUniform.b,
			alpha
		);

		const nearLeftEdge = transformedUV.x
			.greaterThanEqual(0)
			.and(transformedUV.x.lessThan(this.debugLineWidthX));
		const nearRightEdge = transformedUV.x
			.greaterThan(float(1).sub(this.debugLineWidthX))
			.and(transformedUV.x.lessThanEqual(1));
		const nearTopEdge = transformedUV.y
			.greaterThan(float(1).sub(this.debugLineWidthY))
			.and(transformedUV.y.lessThanEqual(1));
		const nearBottomEdge = transformedUV.y
			.greaterThanEqual(0)
			.and(transformedUV.y.lessThan(this.debugLineWidthY));
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

	private screenToTextUV(screenUV: Node, canvas: Canvas2D): Node {
		const screenPixelX = screenUV.x.mul(canvas.widthUniform);
		const screenPixelY = screenUV.y.mul(canvas.heightUniform);

		return vec2(
			screenPixelX.div(this.widthUniform),
			screenPixelY.div(this.heightUniform)
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
}
