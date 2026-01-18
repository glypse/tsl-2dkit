import { type uniform } from "three/tsl";
import {
	type Texture,
	LinearFilter,
	NearestFilter,
	type Node
} from "three/webgpu";
import { TSLScene2D } from "../core";
import { TSLPassNode } from "../core/TSLPass";
import { type WrapMode } from "../utils";

/** Texture interpolation mode for minification and magnification filtering. */
export type InterpolationMode = "linear" | "nearest";

/**
 * Base class for CPU-driven textures that can be refreshed on demand.
 * Subclasses set `needsUpdate = true` when their CPU backing changes; the
 * TSLScene2D render loop will call `updateIfNeeded()` and upload the new pixels
 * before rendering.
 */
export abstract class UpdatableTexture {
	needsUpdate = true;
	wrapMode: WrapMode = "clamp";
	private _interpolationMode: InterpolationMode = "linear";

	protected _texture: Texture;

	private _readyPromise: Promise<void>;
	private _resolveReady!: () => void;
	private _isReady = false;

	protected constructor(texture: Texture) {
		this._texture = texture;

		// Initialize ready promise
		this._readyPromise = new Promise<void>((resolve) => {
			this._resolveReady = resolve;
		});
	}

	/**
	 * Get the underlying Three.js texture.
	 *
	 * @returns The texture instance
	 */
	get texture(): Texture {
		return this._texture;
	}

	/**
	 * Get the width of the texture in pixels. Subclasses should implement this
	 * to return their actual width.
	 */
	protected abstract getWidth(): number;

	/**
	 * Get the height of the texture in pixels. Subclasses should implement this
	 * to return their actual height.
	 */
	protected abstract getHeight(): number;

	/**
	 * Width of the texture in pixels. Warns if accessed outside of TSL context.
	 *
	 * @returns The width in pixels
	 */
	get width(): number {
		try {
			void TSLScene2D.currentScene;
		} catch {
			try {
				void TSLPassNode.currentPass;
			} catch {
				console.warn(
					`[${this.constructor.name}] Accessing width outside of TSLScene2D.build() or TSLPassNode context. The value may not be initialized yet.`
				);
			}
		}
		return this.getWidth();
	}

	/**
	 * Height of the texture in pixels. Warns if accessed outside of TSL
	 * context.
	 *
	 * @returns The height in pixels
	 */
	get height(): number {
		try {
			void TSLScene2D.currentScene;
		} catch {
			try {
				void TSLPassNode.currentPass;
			} catch {
				console.warn(
					`[${this.constructor.name}] Accessing height outside of TSLScene2D.build() or TSLPassNode context. The value may not be initialized yet.`
				);
			}
		}
		return this.getHeight();
	}

	/**
	 * Get the aspect ratio of the texture. Subclasses can override this to
	 * provide custom aspect ratio logic. Default implementation returns width /
	 * height, or 1 if height is 0.
	 */
	protected abstract getAspectRatio(): number;

	/**
	 * Get a uniform node representing the texture's width in pixels. This
	 * uniform automatically updates when the texture changes. Use this in your
	 * node graph for reactive width handling.
	 */
	abstract get widthUniform(): ReturnType<typeof uniform<number>>;

	/**
	 * Get a uniform node representing the texture's height in pixels. This
	 * uniform automatically updates when the texture changes. Use this in your
	 * node graph for reactive height handling.
	 */
	abstract get heightUniform(): ReturnType<typeof uniform<number>>;

	/**
	 * Get a uniform node representing the texture's aspect ratio
	 * (width/height). This uniform automatically updates when the texture
	 * changes. Use this in your node graph for reactive aspect ratio handling.
	 */
	abstract get aspectUniform(): ReturnType<typeof uniform<number>>;

	/**
	 * Sample this texture using provided UVs. Implementations should register
	 * themselves with the active scene if they need per-frame updates.
	 */
	abstract sample(inputUV?: Node): Node;

	/**
	 * Aspect ratio (width / height). Warns if accessed outside of TSL context.
	 *
	 * @returns The aspect ratio
	 */
	get aspectRatio(): number {
		try {
			void TSLScene2D.currentScene;
		} catch {
			try {
				void TSLPassNode.currentPass;
			} catch {
				console.warn(
					`[${this.constructor.name}] Accessing aspectRatio outside of TSLScene2D.build() or TSLPassNode context. The value may not be initialized yet.`
				);
			}
		}
		return this.getAspectRatio();
	}

	/**
	 * Get the current interpolation mode.
	 *
	 * @returns The current interpolation mode ("linear" or "nearest")
	 */
	get interpolation(): InterpolationMode {
		return this._interpolationMode;
	}

	/** Set the interpolation mode for texture sampling. */
	set interpolation(mode: InterpolationMode) {
		this._interpolationMode = mode;
		const filter = mode === "nearest" ? NearestFilter : LinearFilter;
		this._texture.minFilter = filter;
		this._texture.magFilter = filter;
		this._texture.needsUpdate = true;
	}

	/**
	 * Apply the current interpolation mode to the texture. Should be called
	 * whenever the internal texture is replaced.
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
	 * Mark this texture as ready. Subclasses should call this when their async
	 * initialization is complete (e.g., after media loads or fonts load).
	 * Textures that are immediately ready can call this in their constructor.
	 */
	protected markReady(): void {
		if (this._isReady) return;
		this._isReady = true;
		this._resolveReady();
	}

	/**
	 * Check if the texture is fully loaded and ready for rendering.
	 *
	 * @returns True if the texture is ready, false otherwise
	 */
	get ready(): boolean {
		return this._isReady;
	}

	/**
	 * Wait for the texture to be fully loaded and ready. Resolves immediately
	 * if already ready.
	 *
	 * @returns A promise that resolves when the texture is ready.
	 */
	waitUntilReady(): Promise<void> {
		return this._readyPromise;
	}

	/**
	 * Dispose of the texture resources. Subclasses should override to clean up
	 * additional resources.
	 */
	dispose(): void {
		this._texture.dispose();
	}
}
