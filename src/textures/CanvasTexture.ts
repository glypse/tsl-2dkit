import { CanvasTexture as ThreeCanvasTexture, TextureNode } from "three/webgpu";
import { texture, vec4, vec2, uniform, select, uv, float } from "three/tsl";
import type { Node, UniformNode } from "three/webgpu";
import { TSLScene2D } from "../core";
import { UpdatableTexture } from "./UpdatableTexture";
import { wrapUV } from "../utils";

export type CanvasTextureOptions = {
	/**
	 * The canvas element to use as a texture source.
	 * Can be an HTMLCanvasElement or OffscreenCanvas.
	 */
	canvas: HTMLCanvasElement | OffscreenCanvas;
	/**
	 * Anchor point for horizontal alignment.
	 */
	anchorX: string;
	/**
	 * Anchor point for vertical alignment.
	 */
	anchorY: string;
	/**
	 * Show debug borders around the texture bounds.
	 */
	debug: boolean;
};

/**
 * A texture that uses an external canvas element as its source.
 * This allows you to draw on a canvas using the standard Canvas 2D API
 * and use the result as a texture in tsl-2dkit.
 *
 * @example
 * ```ts
 * const canvas = document.createElement("canvas");
 * canvas.width = 512;
 * canvas.height = 512;
 * const ctx = canvas.getContext("2d")!;
 *
 * // Draw something
 * ctx.fillStyle = "red";
 * ctx.fillRect(0, 0, 256, 256);
 *
 * const canvasTexture = new CanvasTexture({ canvas });
 *
 * // When you update the canvas, mark the texture as needing update
 * ctx.fillStyle = "blue";
 * ctx.fillRect(256, 256, 256, 256);
 * canvasTexture.needsUpdate = true;
 * ```
 */
export class CanvasTexture<
	TParameters extends CanvasTextureOptions = CanvasTextureOptions
> extends UpdatableTexture {
	parameters: TParameters;

	protected _widthUniform = uniform(0);
	protected _heightUniform = uniform(0);
	protected _aspectUniform = uniform(1);
	protected anchorOffsetXUniform = uniform(0.5);
	protected anchorOffsetYUniform = uniform(0.5);
	protected debugUniform = uniform(0);
	protected debugLineWidthX = uniform(0);
	protected debugLineWidthY = uniform(0);

	protected sourceCanvas: HTMLCanvasElement | OffscreenCanvas;
	private textureNode: TextureNode | null = null;

	constructor(
		parameters: Partial<TParameters> & {
			canvas: HTMLCanvasElement | OffscreenCanvas;
		}
	) {
		const canvasTexture = new ThreeCanvasTexture(parameters.canvas);
		canvasTexture.generateMipmaps = false;
		canvasTexture.needsUpdate = true;

		super(canvasTexture);

		this.sourceCanvas = parameters.canvas;

		this.parameters = {
			canvas: parameters.canvas,
			anchorX: parameters.anchorX ?? ("center" as TParameters["anchorX"]),
			anchorY: parameters.anchorY ?? ("center" as TParameters["anchorY"]),
			debug: parameters.debug ?? false
		} as TParameters;

		// Initialize uniforms
		this._widthUniform.value = this.sourceCanvas.width;
		this._heightUniform.value = this.sourceCanvas.height;
		this._aspectUniform.value =
			this.sourceCanvas.width / this.sourceCanvas.height || 1;

		// CanvasTexture is immediately ready since it uses a pre-existing canvas
		this.markReady();
	}

	/**
	 * Sample this texture using provided UVs.
	 * Registers with the active scene for per-frame updates.
	 */
	sample(inputUV?: Node): Node {
		const scene = TSLScene2D.currentScene;

		// Register for per-frame updates
		scene.registerUpdatableTexture(this);

		const rawUV = inputUV ?? uv();
		return this.sampleTexture(rawUV);
	}

	protected update(): void | Promise<void> {
		const { anchorX, anchorY, debug } = this.parameters;

		const canvasWidth = this.sourceCanvas.width;
		const canvasHeight = this.sourceCanvas.height;

		if (canvasWidth === 0 || canvasHeight === 0) {
			console.warn(
				"[CanvasTexture] Canvas dimensions are zero:",
				canvasWidth,
				"x",
				canvasHeight
			);
			return;
		}

		// Update uniforms
		this._widthUniform.value = canvasWidth;
		this._heightUniform.value = canvasHeight;
		this._aspectUniform.value = canvasWidth / canvasHeight;
		this.debugUniform.value = debug ? 1 : 0;
		this.debugLineWidthX.value = 1 / canvasWidth;
		this.debugLineWidthY.value = 1 / canvasHeight;

		this.anchorOffsetXUniform.value = this.computeAnchorOffsetX(anchorX);
		this.anchorOffsetYUniform.value = this.computeAnchorOffsetY(anchorY);
	}

	protected sampleTexture(inputUV: Node): Node {
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

		const debugColor = vec4(1, 0, 1, 1);

		return select(
			inBounds,
			select(
				isEdge.and(this.debugUniform.greaterThan(0)),
				debugColor,
				sampled
			),
			vec4(0, 0, 0, 0)
		);
	}

	protected computeAnchorOffsetX(anchorX: string): number {
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

	protected computeAnchorOffsetY(anchorY: string): number {
		switch (anchorY) {
			case "top":
				return 1;
			case "bottom":
				return 0;
			case "center":
			default:
				return 0.5;
		}
	}

	protected getWidth(): number {
		return this.sourceCanvas.width;
	}

	protected getHeight(): number {
		return this.sourceCanvas.height;
	}

	protected getAspectRatio(): number {
		const h = this.getHeight();
		return h > 0 ? this.getWidth() / h : 1;
	}

	/**
	 * Get a uniform node representing the texture's width in pixels.
	 */
	get widthUniform(): UniformNode<number> {
		return this._widthUniform;
	}

	/**
	 * Get a uniform node representing the texture's height in pixels.
	 */
	get heightUniform(): UniformNode<number> {
		return this._heightUniform;
	}

	/**
	 * Get a uniform node representing the texture's aspect ratio (width/height).
	 */
	get aspectUniform(): UniformNode<number> {
		return this._aspectUniform;
	}

	/**
	 * Update the source canvas. Useful if you want to switch to a different canvas.
	 */
	setCanvas(canvas: HTMLCanvasElement | OffscreenCanvas): void {
		this.sourceCanvas = canvas;
		this.parameters.canvas = canvas;

		// Dispose old texture and create new one
		this._texture.dispose();
		const newTexture = new ThreeCanvasTexture(canvas);
		newTexture.generateMipmaps = false;
		newTexture.needsUpdate = true;

		if (this.textureNode) {
			this.textureNode.value = newTexture;
		}

		this._texture = newTexture;
		this.applyInterpolation();
		this.needsUpdate = true;
	}
}
