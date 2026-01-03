import type { Texture } from "three";

/**
 * Base class for CPU-driven textures that can be refreshed on demand.
 * Subclasses set `needsUpdate = true` when their CPU backing changes; the
 * Canvas2D render loop will call `updateIfNeeded()` and upload the new pixels
 * before rendering.
 */
export abstract class DynamicTexture {
	needsUpdate = true;

	protected _texture: Texture;

	protected constructor(texture: Texture) {
		this._texture = texture;
	}

	get texture(): Texture {
		return this._texture;
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
