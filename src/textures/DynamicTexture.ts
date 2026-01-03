import type { WrapMode } from "$lib/utils";
import type { Texture } from "three";
import { LinearFilter, NearestFilter } from "three";

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
