import {
	RenderTarget,
	Vector2,
	HalfFloatType,
	type TextureDataType
} from "three";
import {
	QuadMesh,
	NodeMaterial,
	RendererUtils,
	TempNode,
	NodeUpdateType,
	Node,
	NodeFrame,
	NodeBuilder,
	TextureNode
} from "three/webgpu";
import { nodeObject, Fn, uv, texture, convertToTexture } from "three/tsl";

// Type for the renderer state returned by RendererUtils.resetRendererState
type RendererState = ReturnType<(typeof RendererUtils)["resetRendererState"]>;

const _size = new Vector2();
const _quadMesh = new QuadMesh();

let _rendererState: RendererState;

export type FeedbackTextureOptions = {
	/**
	 * Initial width of the feedback buffer. If not specified, it will be
	 * auto-sized from the renderer.
	 */
	width?: number;
	/**
	 * Initial height of the feedback buffer. If not specified, it will be
	 * auto-sized from the renderer.
	 */
	height?: number;
};

/**
 * A ping-pong feedback texture node for creating trail/echo effects.
 *
 * This is a TSL node that maintains two render targets internally and swaps
 * them each frame, allowing you to sample from the previous frame while
 * rendering to the current frame.
 *
 * Based on Three.js's AfterImageNode pattern but allows custom feedback logic.
 *
 * @example
 *
 * ```ts
 * // Create the feedback node with a custom compositing function
 * const feedbackNode = feedback(
 * 	currentFrameNode, // Your current frame's content
 * 	(current, previous) => {
 * 		// Custom compositing: mix current with faded previous
 * 		return max(current, previous.mul(0.95));
 * 	}
 * );
 *
 * // Use in your material or post-processing
 * material.colorNode = feedbackNode;
 * ```
 */
class FeedbackTextureNode extends TempNode {
	readonly isFeedbackTextureNode = true;

	static override get type(): string {
		return "FeedbackTextureNode";
	}

	/** The texture node that represents the current frame input. */
	textureNode: Node;

	/** Function that composites current and previous frames. */
	compositeCallback: (current: Node, previous: Node) => Node;

	/** The render target used for compositing the effect (current write target). */
	private _compRT: RenderTarget;

	/**
	 * The render target that represents the previous frame (current read
	 * target).
	 */
	private _oldRT: RenderTarget;

	/** The result of the effect as a texture node. */
	private _textureNode: TextureNode;

	/** Texture node for reading the previous frame. */
	private _textureNodeOld: TextureNode;

	/** Material used for compositing. */
	private _materialComposed: NodeMaterial | null = null;

	/** Whether dimensions have been initialized. */
	private _initialized = false;

	constructor(
		textureNode: Node,
		compositeCallback: (current: Node, previous: Node) => Node,
		options: FeedbackTextureOptions = {}
	) {
		super("vec4");

		this.textureNode = textureNode;
		this.compositeCallback = compositeCallback;

		const width = options.width ?? 1;
		const height = options.height ?? 1;

		// Create ping-pong render targets
		this._compRT = new RenderTarget(width, height, { depthBuffer: false });
		this._compRT.texture.name = "FeedbackTexture.comp";
		this._compRT.texture.type = HalfFloatType;

		this._oldRT = new RenderTarget(width, height, { depthBuffer: false });
		this._oldRT.texture.name = "FeedbackTexture.old";
		this._oldRT.texture.type = HalfFloatType;

		// Create texture nodes for sampling
		// Use texture() directly - at runtime this works like passTexture
		// but with correct typing since we're a TempNode, not PassNode
		this._textureNode = texture(this._compRT.texture);
		this._textureNodeOld = texture(this._oldRT.texture);

		// Update once per frame
		this.updateBeforeType = NodeUpdateType.FRAME;
	}

	/** Returns the result of the effect as a texture node. */
	getTextureNode(): TextureNode {
		return this._textureNode;
	}

	/** Sets the size of the feedback buffers. */
	setSize(width: number, height: number): void {
		this._compRT.setSize(width, height);
		this._oldRT.setSize(width, height);
	}

	/** Called once per frame to render the feedback effect. */
	override updateBefore(frame: NodeFrame): void {
		const { renderer } = frame;
		if (!renderer) return;

		// Save renderer state
		_rendererState = RendererUtils.resetRendererState(
			renderer,
			_rendererState
		);

		// Get texture type from input - TextureNode extends UniformNode<Texture>
		// so we can access .value to get the underlying texture
		const inputTexture = this.textureNode as TextureNode;
		const map = inputTexture.value;
		const textureType: TextureDataType = map.type;

		this._compRT.texture.type = textureType;
		this._oldRT.texture.type = textureType;

		// Auto-size from renderer if not initialized
		if (!this._initialized) {
			renderer.getDrawingBufferSize(_size);
			this.setSize(_size.x, _size.y);
			this._initialized = true;
		}

		// Update texture node references to current targets
		this._textureNode.value = this._compRT.texture;
		this._textureNodeOld.value = this._oldRT.texture;

		// Render composite to _compRT
		if (this._materialComposed) {
			_quadMesh.material = this._materialComposed;
			_quadMesh.name = "FeedbackTexture";
			renderer.setRenderTarget(this._compRT);
			_quadMesh.render(renderer);
		}

		// Swap render targets (ping-pong)
		const temp = this._oldRT;
		this._oldRT = this._compRT;
		this._compRT = temp;

		// Restore renderer state
		RendererUtils.restoreRendererState(renderer, _rendererState);
	}

	/** Sets up the TSL shader code for the feedback effect. */
	override setup(builder: NodeBuilder): Node {
		// Cast to TextureNode to access uvNode and sample()
		const textureNode = this.textureNode as TextureNode;
		const textureNodeOld = this._textureNodeOld;

		// Use same UVs for old texture
		textureNodeOld.uvNode = textureNode.uvNode ?? uv();

		// Create the compositing shader
		const compositeShader = Fn(() => {
			// TextureNode.sample() returns a Node representing the sampled color
			const texelNew = textureNode.sample(textureNode.uvNode ?? uv());
			const texelOld = textureNodeOld.sample(
				textureNodeOld.uvNode ?? uv()
			);

			// Call user's composite function
			return this.compositeCallback(texelNew, texelOld);
		});

		// Create or update the compositing material
		const materialComposed =
			this._materialComposed ??
			(this._materialComposed = new NodeMaterial());
		materialComposed.name = "FeedbackTexture";
		materialComposed.fragmentNode = compositeShader();

		// Store properties for the builder
		const properties = builder.getNodeProperties(this) as {
			textureNode: Node;
		};
		properties.textureNode = textureNode;

		return this._textureNode;
	}

	/** Dispose of GPU resources. */
	dispose(): void {
		this._compRT.dispose();
		this._oldRT.dispose();
	}
}

/**
 * Creates a feedback texture node for ping-pong rendering effects like trails,
 * echoes, etc.
 *
 * @example
 *
 * ```ts
 * // Simple trail effect with decay
 * const trailEffect = feedback(myColorNode, (current, previous) =>
 * 	max(current, previous.mul(0.95))
 * );
 *
 * // Motion blur style
 * const motionBlur = feedback(scenePass, (current, previous) =>
 * 	mix(current, previous, 0.8)
 * );
 * ```
 *
 * @param node - The input node (your current frame content). Will be converted
 *   to a texture.
 * @param composite - Function that combines current and previous frames.
 *   Receives (current, previous) and should return the composited result.
 * @param options - Optional configuration.
 * @returns A FeedbackTextureNode that can be used in your shader graph.
 */
export function feedback(
	node: Node,
	composite: (current: Node, previous: Node) => Node,
	options?: FeedbackTextureOptions
): FeedbackTextureNode {
	const textureNode = convertToTexture(node);
	return nodeObject(new FeedbackTextureNode(textureNode, composite, options));
}

// Also export the class for advanced usage
export { FeedbackTextureNode };

// Default export for convenience
export default FeedbackTextureNode;
