import { texture, uv, convertToTexture, nodeObject, uniform } from "three/tsl";
import {
	Vector2,
	type Node,
	type NodeFrame,
	type UniformNode,
	TempNode,
	NodeUpdateType
} from "three/webgpu";
// Type import needed for documentation linking
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { type UpdatableTexture } from "../textures";

/**
 * A TSL-based post-processing pass that can be integrated with Three.js's
 * PostProcessing system. This allows you to use tsl-2dkit effects as part of a
 * larger post-processing pipeline.
 *
 * @example
 *
 * ```ts
 * import { PostProcessing } from "three/webgpu";
 * import { pass } from "three/tsl";
 * import { tslPass } from "tsl-2dkit";
 *
 * const postProcessing = new PostProcessing(renderer);
 * const scenePass = pass(scene, camera);
 * const scenePassColor = scenePass.getTextureNode("output");
 *
 * const colorGraded = tslPass(scenePassColor, (input) => {
 * 	const color = input.sample(uv());
 * 	return color.rgb.mul(vec3(1.2, 1.0, 0.8)); // Warm color grade
 * });
 *
 * postProcessing.outputNode = colorGraded;
 * ```
 */
export class TSLPassNode extends TempNode {
	private _effectCallback: (inputTexture: InputTextureNode) => Node;
	private _inputNode: Node;

	// Current pass width/height (updated automatically from renderer)
	_width = 0;
	_height = 0;

	// Uniforms for use in shaders
	readonly widthUniform: UniformNode<number>;
	readonly heightUniform: UniformNode<number>;

	// Static reference for context detection
	private static _currentPass: TSLPassNode | null = null;

	// Store registered textures that need updates
	private _updatableTextures = new Set<{
		updateIfNeeded: () => Promise<void>;
	}>();

	/**
	 * Creates a new TSL-based post-processing pass.
	 *
	 * @param inputNode - The input node from a previous rendering pass or
	 *   effect
	 * @param callback - Function that receives the input texture and returns
	 *   the processed output node
	 */
	constructor(
		inputNode: Node,
		callback: (inputTexture: InputTextureNode) => Node
	) {
		super("vec4");

		this._inputNode = inputNode;
		this._effectCallback = callback;

		// Initialize uniforms
		this.widthUniform = uniform(1);
		this.heightUniform = uniform(1);

		// Set to update before each frame (like bloom)
		this.updateBeforeType = NodeUpdateType.FRAME;
	}

	/**
	 * Get the currently active TSLPass (for texture registration).
	 *
	 * @returns The current TSLPassNode instance if one is being set up, null
	 *   otherwise
	 */
	static get currentPass(): TSLPassNode | null {
		return TSLPassNode._currentPass;
	}

	/**
	 * Get the current width of the pass.
	 *
	 * @returns The logical width of the pass in pixels (accounting for device
	 *   pixel ratio)
	 */
	get width(): number {
		return this._width;
	}

	/**
	 * Get the current height of the pass.
	 *
	 * @returns The logical height of the pass in pixels (accounting for device
	 *   pixel ratio)
	 */
	get height(): number {
		return this._height;
	}

	/**
	 * Register a texture that needs per-frame updates.
	 *
	 * @param texture - The texture object with an updateIfNeeded method
	 * @param texture.updateIfNeeded - {@link UpdatableTexture.updateIfNeeded}
	 * @internal
	 */
	registerUpdatableTexture(texture: {
		updateIfNeeded: () => Promise<void>;
	}): void {
		this._updatableTextures.add(texture);
	}

	/**
	 * Called automatically before each frame to update size and textures.
	 *
	 * @param frame - The node frame containing renderer information
	 * @internal
	 */
	updateBefore(frame: NodeFrame): void {
		const { renderer } = frame;

		if (!renderer) return;

		// Get physical size from renderer
		const size = renderer.getDrawingBufferSize(new Vector2());
		const dpr = renderer.getPixelRatio();

		// Store logical dimensions (like TSLScene2D does)
		this._width = size.x / dpr;
		this._height = size.y / dpr;

		// Update uniforms with logical dimensions
		this.widthUniform.value = this._width;
		this.heightUniform.value = this._height;

		// Update all registered textures
		if (this._updatableTextures.size > 0) {
			// Fire and forget - don't await
			void Promise.all(
				Array.from(this._updatableTextures, (tex) =>
					tex.updateIfNeeded()
				)
			);
		}
	}

	/**
	 * Setup the effect's TSL code.
	 *
	 * @returns The TSL node representing the effect's output
	 * @internal
	 */
	setup(): Node {
		// Set this as the current pass for texture registration
		TSLPassNode._currentPass = this;

		try {
			// Convert the input node to a texture that can be sampled
			const inputTextureNode = new InputTextureNode(this._inputNode);

			// Build and return the effect
			return this._effectCallback(inputTextureNode);
		} finally {
			TSLPassNode._currentPass = null;
		}
	}
}

/**
 * A wrapper that allows sampling from the input texture of a pass. This
 * provides a consistent interface for accessing the previous pass's output.
 */
export class InputTextureNode {
	private _inputNode: Node;
	private _textureNode: Node | null = null;

	/**
	 * Creates a new InputTextureNode wrapper.
	 *
	 * @param inputNode - The input node to wrap
	 */
	constructor(inputNode: Node) {
		this._inputNode = inputNode;
	}

	/**
	 * Sample the input texture at the given UV coordinates.
	 *
	 * @param inputUV - UV coordinates to sample at. Defaults to standard UVs.
	 * @default uv()
	 * @returns A Node representing the sampled color (vec4)
	 */
	sample(inputUV?: Node): Node {
		const UV = inputUV ?? uv();

		// Try to get the texture node from the input
		// PassNode has getTextureNode() method
		const inputNode = this._inputNode as {
			getTextureNode?: () => Node;
		};

		if (inputNode.getTextureNode) {
			this._textureNode ??= inputNode.getTextureNode();
			// The texture node can be sampled directly
			return texture(this._textureNode as never, UV);
		}

		// If it's already a texture-like node, use it directly
		// This handles cases where the input is already a texture node
		this._textureNode ??= convertToTexture(this._inputNode);

		return texture(this._textureNode as never, UV);
	}

	/**
	 * Get the raw input node without sampling. Useful for passes that output
	 * something other than a texture.
	 *
	 * @returns The unwrapped input node
	 */
	get raw(): Node {
		return this._inputNode;
	}
}

/**
 * Convenience function to create a TSL effect pass. This provides a simple,
 * bloom-like API for post-processing effects.
 *
 * @example
 *
 * ```ts
 * const warmGrade = tslPass(scenePassColor, (input) => {
 * 	const color = input.sample(uv());
 * 	return color.rgb.mul(vec3(1.2, 1.0, 0.8));
 * });
 *
 * postProcessing.outputNode = warmGrade;
 * ```
 *
 * @param inputNode - The input node from a previous pass
 * @param callback - Function that receives the input and returns the processed
 *   output
 * @returns A node representing the effect output
 */
export function tslPass(
	inputNode: Node,
	callback: (inputTexture: InputTextureNode) => Node
): TSLPassNode {
	return nodeObject(new TSLPassNode(nodeObject(inputNode), callback));
}

export default TSLPassNode;
