import { uniform } from "three/tsl";
import type { Node, UniformNode } from "three/webgpu";
import type { UpdatableTexture } from "../textures/UpdatableTexture";
import type { FeedbackTextureNode } from "../textures/FeedbackTexture";

/**
 * Abstract base class for 2D TSL rendering contexts.
 * Both TSLScene2D and TSLPass extend this to share common functionality
 * like dimension management and texture registration.
 */
export abstract class TSLContext2D {
	protected _width: number;
	protected _height: number;

	protected _widthUniform: UniformNode<number>;
	protected _heightUniform: UniformNode<number>;

	protected UpdatableTextures = new Set<UpdatableTexture>();
	protected FeedbackTextures = new Set<FeedbackTextureNode>();

	constructor(width: number, height: number) {
		this._width = width;
		this._height = height;

		this._widthUniform = uniform(this._width || 1);
		this._heightUniform = uniform(this._height || 1);
	}

	/**
	 * Register an UpdatableTexture for per-frame updates.
	 */
	registerUpdatableTexture(texture: UpdatableTexture): void {
		this.UpdatableTextures.add(texture);
	}

	/**
	 * Register a FeedbackTexture for tracking purposes.
	 */
	registerFeedbackTexture(feedbackTexture: FeedbackTextureNode): void {
		this.FeedbackTextures.add(feedbackTexture);
	}

	/**
	 * Update dimensions.
	 */
	setSize(width: number, height: number): void {
		this._width = width;
		this._height = height;
		this._widthUniform.value = width;
		this._heightUniform.value = height;
	}

	/**
	 * Update all registered UpdatableTextures.
	 */
	async updateTextures(): Promise<void> {
		if (!this.UpdatableTextures.size) return;
		await Promise.all(
			Array.from(this.UpdatableTextures, (tex) => tex.updateIfNeeded())
		);
	}

	// Dimension accessors

	get width(): number {
		return this._width;
	}

	get height(): number {
		return this._height;
	}

	get widthUniform(): UniformNode<number> {
		return this._widthUniform;
	}

	get heightUniform(): UniformNode<number> {
		return this._heightUniform;
	}

	get aspect(): number {
		return this._width / (this._height || 1);
	}

	get aspectUniform(): Node {
		return this._widthUniform.div(this._heightUniform);
	}
}
