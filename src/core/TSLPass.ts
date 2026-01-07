import { texture, uv, uniform, convertToTexture } from "three/tsl";
import type { Node, UniformNode } from "three/webgpu";
import type { FeedbackTextureNode } from "../textures/FeedbackTexture";
import type { UpdatableTexture } from "../textures/UpdatableTexture";

export type TSLPassOptions = {
	/**
	 * Width of the pass. If not provided, will be inferred from the renderer.
	 */
	width?: number;
	/**
	 * Height of the pass. If not provided, will be inferred from the renderer.
	 */
	height?: number;
};

/**
 * A TSL-based post-processing pass that can be integrated with Three.js's PostProcessing system.
 * This allows you to use tsl-2dkit effects as part of a larger post-processing pipeline.
 *
 * @example
 * ```ts
 * import { PostProcessing } from "three/webgpu";
 * import { pass } from "three/tsl";
 * import { TSLPass } from "tsl-2dkit";
 *
 * // Create the post-processing instance
 * const postProcessing = new PostProcessing(renderer);
 *
 * // Create a scene pass (renders your 3D scene)
 * const scenePass = pass(scene, camera);
 *
 * // Create a TSL pass for 2D effects
 * const tslPass = new TSLPass();
 *
 * // Build your effect chain
 * const effectNode = tslPass.build((inputTexture) => {
 *   // inputTexture is the result from the previous pass
 *   const sampled = inputTexture.sample(uv());
 *
 *   // Apply some effect
 *   return sampled.rgb.mul(vec3(1.2, 1.0, 0.8)); // Warm color grade
 * });
 *
 * // Connect the scene pass to the TSL pass
 * postProcessing.outputNode = tslPass.apply(scenePass);
 * ```
 */
export class TSLPass {
	private _width: number;
	private _height: number;

	private _widthUniform: UniformNode<number>;
	private _heightUniform: UniformNode<number>;

	private _effectCallback?: (inputTexture: InputTextureNode) => Node;
	private _outputNode: Node | null = null;

	private UpdatableTextures = new Set<UpdatableTexture>();
	private FeedbackTextures = new Set<FeedbackTextureNode>();

	// Static reference for context detection (similar to TSLScene2D)
	private static _currentPass: TSLPass | null = null;

	constructor(options: TSLPassOptions = {}) {
		this._width = options.width ?? 0;
		this._height = options.height ?? 0;

		this._widthUniform = uniform(this._width || 1);
		this._heightUniform = uniform(this._height || 1);
	}

	/**
	 * Get the currently active TSLPass (for texture registration).
	 */
	static get currentPass(): TSLPass | null {
		return TSLPass._currentPass;
	}

	/**
	 * Build the effect with a callback that receives the input texture.
	 * The callback should return a Node representing the final color output.
	 *
	 * @param callback - Function that takes an InputTextureNode and returns the processed output
	 */
	build(callback: (inputTexture: InputTextureNode) => Node): this {
		this._effectCallback = callback;
		return this;
	}

	/**
	 * Apply this pass to the output of a previous pass (e.g., a scene pass).
	 * Returns a Node that can be used as the outputNode for PostProcessing.
	 *
	 * @param inputNode - The input node from a previous pass (e.g., from pass(scene, camera))
	 * @returns A Node representing the processed output
	 */
	apply(inputNode: Node): Node {
		if (!this._effectCallback) {
			throw new Error(
				"[TSLPass] No effect callback defined. Call build() first."
			);
		}

		// Set this as the current pass for texture registration
		TSLPass._currentPass = this;

		try {
			// Convert the input node to a texture that can be sampled
			const inputTextureNode = new InputTextureNode(inputNode);

			// Build the effect
			this._outputNode = this._effectCallback(inputTextureNode);

			return this._outputNode;
		} finally {
			TSLPass._currentPass = null;
		}
	}

	/**
	 * Create a standalone effect node that doesn't take input from a previous pass.
	 * Useful for generating procedural content or overlays.
	 *
	 * @param callback - Function that returns the effect output
	 * @returns A Node representing the effect output
	 */
	generate(callback: () => Node): Node {
		TSLPass._currentPass = this;

		try {
			this._outputNode = callback();
			return this._outputNode;
		} finally {
			TSLPass._currentPass = null;
		}
	}

	/**
	 * Register an UpdatableTexture for per-frame updates.
	 */
	registerUpdatableTexture(texture: UpdatableTexture): void {
		this.UpdatableTextures.add(texture);
	}

	/**
	 * Register a FeedbackTexture for ping-pong buffer management.
	 */
	registerFeedbackTexture(feedbackTexture: FeedbackTextureNode): void {
		this.FeedbackTextures.add(feedbackTexture);
	}

	/**
	 * Update dimensions. Call this when the renderer size changes.
	 */
	setSize(width: number, height: number): void {
		this._width = width;
		this._height = height;
		this._widthUniform.value = width;
		this._heightUniform.value = height;
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

/**
 * A wrapper that allows sampling from the input texture of a pass.
 * This provides a consistent interface for accessing the previous pass's output.
 */
export class InputTextureNode {
	private _inputNode: Node;
	private _textureNode: Node | null = null;

	constructor(inputNode: Node) {
		this._inputNode = inputNode;
	}

	/**
	 * Sample the input texture at the given UV coordinates.
	 *
	 * @param inputUV - UV coordinates to sample at. Defaults to standard UVs.
	 * @returns A Node representing the sampled color (vec4)
	 */
	sample(inputUV?: Node): Node {
		const UV = inputUV ?? uv();

		// Try to get the texture node from the input
		// PassNode has getTextureNode() method
		const inputNodeAny = this._inputNode as {
			getTextureNode?: () => Node;
			isPassNode?: boolean;
		};

		if (inputNodeAny.getTextureNode) {
			this._textureNode ??= inputNodeAny.getTextureNode();
			// The texture node can be sampled directly
			return texture(this._textureNode as never, UV);
		}

		// If it's already a texture-like node, use it directly
		// This handles cases where the input is already a texture node
		this._textureNode ??= convertToTexture(this._inputNode);

		return texture(this._textureNode as never, UV);
	}

	/**
	 * Get the raw input node without sampling.
	 * Useful for passes that output something other than a texture.
	 */
	get raw(): Node {
		return this._inputNode;
	}
}

/**
 * Convenience function to create a TSL effect that can be applied to a pass.
 * This is a shorthand for creating a TSLPass and building an effect.
 *
 * @example
 * ```ts
 * const warmGrade = tslEffect((input) => {
 *   const color = input.sample(uv());
 *   return color.rgb.mul(vec3(1.2, 1.0, 0.8));
 * });
 *
 * postProcessing.outputNode = warmGrade(scenePass);
 * ```
 */
export function tslEffect(
	callback: (inputTexture: InputTextureNode) => Node
): (inputNode: Node) => Node {
	const pass = new TSLPass();
	pass.build(callback);

	return (inputNode: Node) => pass.apply(inputNode);
}
