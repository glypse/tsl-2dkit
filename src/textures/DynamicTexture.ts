import type { WrapMode } from "$lib/utils";
import type { Texture } from "three";
import { LinearFilter, NearestFilter } from "three";
import { Canvas2D } from "../core/scene";
import { uniform } from "three/tsl";

export type InterpolationMode = "linear" | "nearest";

/**
 * Base class for CPU-driven textures that can be refreshed on demand.
 * Subclasses set `needsUpdate = true` when their CPU backing changes; the
 * Canvas2D render loop will call `updateIfNeeded()` and upload the new pixels
 * before rendering.
 */
export abstract class DynamicTexture {
	needsUpdate = true;
	wrapMode: WrapMode = "clamp";
	private _interpolationMode: InterpolationMode = "linear";

	protected _texture: Texture;

	protected constructor(texture: Texture) {
		this._texture = texture;
	}

	get texture(): Texture {
		return this._texture;
	}

	/**
	 * Get the width of the texture in pixels.
	 * Subclasses should implement this to return their actual width.
	 */
	protected abstract getWidth(): number;

	/**
	 * Get the height of the texture in pixels.
	 * Subclasses should implement this to return their actual height.
	 */
	protected abstract getHeight(): number;

	/**
	 * Width of the texture in pixels.
	 * Warns if accessed outside of canvas.draw() context.
	 */
	get width(): number {
		try {
			void Canvas2D.currentCanvas;
		} catch {
			console.warn(
				`[${this.constructor.name}] Accessing width outside of canvas.draw() context. The value may not be initialized yet.`
			);
		}
		return this.getWidth();
	}

	/**
	 * Height of the texture in pixels.
	 * Warns if accessed outside of canvas.draw() context.
	 */
	get height(): number {
		try {
			void Canvas2D.currentCanvas;
		} catch {
			console.warn(
				`[${this.constructor.name}] Accessing height outside of canvas.draw() context. The value may not be initialized yet.`
			);
		}
		return this.getHeight();
	}

	/**
	 * Get the aspect ratio of the texture.
	 * Subclasses can override this to provide custom aspect ratio logic.
	 * Default implementation returns width / height, or 1 if height is 0.
	 */
	protected abstract getAspectRatio(): number;

	/**
	 * Get a uniform node representing the texture's width in pixels.
	 * This uniform automatically updates when the texture changes.
	 * Use this in your node graph for reactive width handling.
	 */
	abstract get widthUniform(): ReturnType<typeof uniform<number>>;

	/**
	 * Get a uniform node representing the texture's height in pixels.
	 * This uniform automatically updates when the texture changes.
	 * Use this in your node graph for reactive height handling.
	 */
	abstract get heightUniform(): ReturnType<typeof uniform<number>>;

	/**
	 * Get a uniform node representing the texture's aspect ratio (width/height).
	 * This uniform automatically updates when the texture changes.
	 * Use this in your node graph for reactive aspect ratio handling.
	 */
	abstract get aspectRatioUniform(): ReturnType<typeof uniform<number>>;

	/**
	 * Aspect ratio (width / height).
	 * Warns if accessed outside of canvas.draw() context.
	 */
	get aspectRatio(): number {
		try {
			void Canvas2D.currentCanvas;
		} catch {
			console.warn(
				`[${this.constructor.name}] Accessing aspectRatio outside of canvas.draw() context. The value may not be initialized yet.`
			);
		}
		return this.getAspectRatio();
	}

	get interpolation(): InterpolationMode {
		return this._interpolationMode;
	}

	set interpolation(mode: InterpolationMode) {
		this._interpolationMode = mode;
		const filter = mode === "nearest" ? NearestFilter : LinearFilter;
		this._texture.minFilter = filter;
		this._texture.magFilter = filter;
		this._texture.needsUpdate = true;
	}

	/**
	 * Apply the current interpolation mode to the texture.
	 * Should be called whenever the internal texture is replaced.
	 */
	protected applyInterpolation(): void {
		const filter =
			this._interpolationMode === "nearest"
				? NearestFilter
				: LinearFilter;
		this._texture.minFilter = filter;
		this._texture.magFilter = filter;
	}

	/**
	 * Refresh GPU upload if marked dirty. Subclasses implement `update()` to
	 * redraw their CPU buffer; the base then flags the texture for GPU upload.
	 */
	async updateIfNeeded(): Promise<void> {
		if (!this.needsUpdate) return;
		await this.update();
		this._texture.needsUpdate = true;
		this.needsUpdate = false;
	}

	protected abstract update(): void | Promise<void>;

	/**
	 * Dispose of the texture resources. Subclasses should override to clean up
	 * additional resources.
	 */
	dispose(): void {
		this._texture.dispose();
	}
}
