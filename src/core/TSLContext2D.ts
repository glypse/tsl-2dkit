import { uniform } from "three/tsl";
import type { Node, UniformNode } from "three/webgpu";
import { type FeedbackTextureNode, type UpdatableTexture } from "../textures";
// Type import needed for documentation linking
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { type TSLScene2D, type TSLPassNode } from "./";

/**
 * Abstract base class for 2D TSL rendering contexts.
 *
 * @description
 * This class provides shared functionality for managing dimensions, uniforms,
 * and texture registration in 2D TSL contexts. Both {@link TSLScene2D} and
 * {@link TSLPassNode} extend this class to inherit common capabilities like
 * dimension management and automatic texture updates.
 *
 * The class maintains internal width and height values alongside their
 * corresponding uniform nodes, enabling reactive dimension changes in shaders.
 * It also tracks registered textures to ensure they are properly updated each
 * frame.
 */
export abstract class TSLContext2D {
	/**
	 * Dispose of all resources managed by this context.
	 *
	 * @remarks
	 * Implementations must dispose of all GPU resources, textures, and other
	 * managed objects to prevent memory leaks. This includes calling dispose()
	 * on all registered textures and clearing internal references.
	 */
	abstract dispose(): void;
	/**
	 * Internal width value in pixels.
	 *
	 * @description
	 * This value is kept in sync with `_widthUniform` to ensure both CPU and
	 * GPU have consistent dimension information.
	 */
	protected _width: number;

	/**
	 * Internal height value in pixels.
	 *
	 * @description
	 * This value is kept in sync with `_heightUniform` to ensure both CPU and
	 * GPU have consistent dimension information.
	 */
	protected _height: number;

	/** Uniform node containing the current width value for shader access. */
	protected _widthUniform: UniformNode<number>;

	/** Uniform node containing the current height value for shader access. */
	protected _heightUniform: UniformNode<number>;

	/**
	 * Set of all registered updatable textures.
	 *
	 * @description
	 * These textures will be automatically updated each frame via
	 * {@link updateTextures}.
	 */
	protected UpdatableTextures = new Set<UpdatableTexture>();

	/**
	 * Set of all registered feedback texture nodes.
	 *
	 * @description
	 * Feedback textures are tracked separately for specialized handling in
	 * post-processing pipelines.
	 */
	protected FeedbackTextures = new Set<FeedbackTextureNode>();

	/**
	 * Creates a new TSL 2D context with the specified dimensions.
	 *
	 * @description
	 * Initializes internal dimension values and creates corresponding uniform
	 * nodes. A fallback value of 1 is used if width or height is 0 to prevent
	 * division by zero in aspect ratio calculations.
	 * @param width - Initial width in pixels
	 * @param height - Initial height in pixels
	 */
	constructor(width: number, height: number) {
		this._width = width;
		this._height = height;

		this._widthUniform = uniform(this._width || 1);
		this._heightUniform = uniform(this._height || 1);
	}

	/**
	 * Registers an updatable texture for automatic per-frame updates.
	 *
	 * @description
	 * Once registered, the texture's {@link UpdatableTexture.updateIfNeeded}
	 * method will be called automatically during each frame's
	 * {@link updateTextures} cycle.
	 * @param texture - The texture to register for updates
	 */
	registerUpdatableTexture(texture: UpdatableTexture): void {
		this.UpdatableTextures.add(texture);
	}

	/**
	 * Registers a feedback texture node for tracking purposes.
	 *
	 * @description
	 * Feedback textures require special handling in the rendering pipeline and
	 * are tracked separately from standard updatable textures.
	 * @param feedbackTexture - The feedback texture node to register
	 */
	registerFeedbackTexture(feedbackTexture: FeedbackTextureNode): void {
		this.FeedbackTextures.add(feedbackTexture);
	}

	/**
	 * Updates the context dimensions.
	 *
	 * @description
	 * This method updates both the internal dimension values and their
	 * corresponding uniform nodes, ensuring the changes are immediately
	 * reflected in shader code.
	 *
	 * Typically called in response to window resize events or when changing
	 * render target dimensions.
	 * @param width - New width in pixels
	 * @param height - New height in pixels
	 */
	setSize(width: number, height: number): void {
		this._width = width;
		this._height = height;
		this._widthUniform.value = width;
		this._heightUniform.value = height;
	}

	/**
	 * Updates all registered {@link UpdatableTexture}.
	 *
	 * @description
	 * This method iterates through all registered {@link UpdatableTexture}
	 * instances and calls their `updateIfNeeded` method. Updates are performed
	 * in parallel using `Promise.all` for optimal performance.
	 *
	 * If no textures are registered, the method returns immediately without
	 * creating any promises.
	 * @returns A promise that resolves when all texture updates complete
	 */
	async updateTextures(): Promise<void> {
		if (!this.UpdatableTextures.size) return;
		await Promise.all(
			Array.from(this.UpdatableTextures, (tex) => tex.updateIfNeeded())
		);
	}

	/**
	 * Gets the current width in pixels.
	 *
	 * @returns The width value
	 */
	get width(): number {
		return this._width;
	}

	/**
	 * Gets the current height in pixels.
	 *
	 * @returns The height value
	 */
	get height(): number {
		return this._height;
	}

	/**
	 * Gets the width uniform node for shader access.
	 *
	 * @description
	 * Use this uniform in shader code to access the current width value. The
	 * uniform automatically updates when {@link setSize} is called.
	 * @returns The width uniform node
	 */
	get widthUniform(): UniformNode<number> {
		return this._widthUniform;
	}

	/**
	 * Gets the height uniform node for shader access.
	 *
	 * @description
	 * Use this uniform in shader code to access the current height value. The
	 * uniform automatically updates when {@link setSize} is called.
	 * @returns The height uniform node
	 */
	get heightUniform(): UniformNode<number> {
		return this._heightUniform;
	}

	/**
	 * Gets the current aspect ratio (width divided by height).
	 *
	 * @description
	 * This computed property returns a numeric aspect ratio value. A fallback
	 * of 1 is used for height to prevent division by zero when height is 0.
	 *
	 * For shader-based aspect ratio calculations, use {@link aspectUniform} instead.
	 * @returns The aspect ratio as a number
	 */
	get aspect(): number {
		return this._width / (this._height || 1);
	}

	/**
	 * Gets a computed aspect ratio uniform node for shader access.
	 *
	 * @description
	 * This returns a TSL node that dynamically computes the aspect ratio by
	 * dividing width by height uniforms. Unlike {@link aspect}, this computation
	 * happens in shader code and updates automatically when dimensions change.
	 * @returns A TSL node representing the aspect ratio
	 */
	get aspectUniform(): Node {
		return this._widthUniform.div(this._heightUniform);
	}
}
