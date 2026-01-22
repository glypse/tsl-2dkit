import Stats from "three/addons/libs/stats.module.js";
import { fxaa } from "three/addons/tsl/display/FXAANode.js";
import { smaa } from "three/addons/tsl/display/SMAANode.js";
import { Fn, vec3 } from "three/tsl";
import {
	Scene,
	type RenderTarget,
	OrthographicCamera,
	Mesh,
	PlaneGeometry,
	SRGBColorSpace,
	Color,
	NoColorSpace,
	LinearFilter,
	WebGPURenderer,
	type Node,
	MeshBasicNodeMaterial,
	CanvasTexture
} from "three/webgpu";
import { TSLContext2D } from "./TSLContext2D";
import { type FixedTime } from "../time/fixedTime";

type MaterialWithColorNode = MeshBasicNodeMaterial & { colorNode: Node };

type RTTNodeLike = Node & {
	isRTTNode?: boolean;
	renderTarget?: RenderTarget;
};

const noTSLScene2DErr = new Error(
	"No active TSLScene2D found. Make sure you're calling this within a TSLScene2D.build() callback."
);

/**
 * Rendering mode for TSLScene2D.
 *
 * - "on-demand": Only renders when requestRender() is called
 * - "continuous": Traditional animation loop using requestAnimationFrame
 */
export type RenderMode = "on-demand" | "continuous";

function throwCanvasNotInitializedError(methodName: string): never {
	throw new Error(`[${methodName}] Canvas not initialized`);
}

/**
 * A 2D scene handler that simplifies creating shader-based 2D graphics with
 * Three.js. Manages the renderer, camera, and render loop, allowing you to
 * focus on writing TSL shader code.
 */
export class TSLScene2D extends TSLContext2D {
	// renderer / scene objects
	private sceneObj: Scene | null = null;
	private rendererObj: WebGPURenderer | null = null;
	private cameraObj: OrthographicCamera | null = null;
	private planeMesh: Mesh | null = null;
	private planeGeometry: PlaneGeometry | null = null;
	private canvasEl: HTMLCanvasElement | null = null;
	private textureObj: CanvasTexture | null = null;

	// material
	private material: MaterialWithColorNode;

	// misc
	private stats?: Stats;
	private antialias: "fxaa" | "smaa" | "none";
	private _drawCallback?: () => Node;
	private _animationFrameId: number | null = null;
	private _nodeGraphBuilt = false;
	private _currentColorNode: Node | null = null;

	// Time control
	private _fixedTime: FixedTime | null = null;

	// Render mode
	private _renderMode: RenderMode;
	private _renderRequested = false;

	// Static reference to current canvas for auto-detection
	private static _currentScene: TSLScene2D | null = null;

	/**
	 * Get the currently active canvas (the one being drawn to).
	 *
	 * @returns The current TSLScene2D instance
	 * @throws Error if no active TSLScene2D is found
	 */
	static get currentScene(): TSLScene2D {
		if (!TSLScene2D._currentScene) {
			throw noTSLScene2DErr;
		}
		return TSLScene2D._currentScene;
	}

	/**
	 * Creates a new TSLScene2D instance.
	 *
	 * @param width - Initial width of the canvas in pixels
	 * @param height - Initial height of the canvas in pixels
	 * @param parameters - Optional configuration parameters
	 * @param parameters.stats - Show FPS stats panel
	 * @default false
	 * @param parameters.antialias - Anti-aliasing mode
	 * @default "none"
	 * @param parameters.renderMode - Rendering mode:
	 * - "on-demand": Only renders when requestRender() is called or when
	 *   tracked changes occur
	 * - "continuous": Traditional animation loop (requestAnimationFrame)
	 * @default "on-demand"
	 */
	constructor(
		width: number,
		height: number,
		parameters?: {
			stats?: boolean;
			antialias?: "fxaa" | "smaa" | "none";
			renderMode?: RenderMode;
		}
	) {
		super(width, height);

		this.antialias = parameters?.antialias ?? "none";
		this._renderMode = parameters?.renderMode ?? "on-demand";

		const outputNode = Fn(() => vec3(0));
		this.material = new MeshBasicNodeMaterial({
			colorNode: outputNode()
		}) as MaterialWithColorNode;

		if (parameters?.stats) {
			this.stats = new Stats();
			document.body.appendChild(this.stats.dom);
		}
	}

	/**
	 * Build the shader scene by providing a callback that returns a TSL node.
	 * This callback defines what gets rendered to the canvas.
	 *
	 * @param callback - Function that returns a TSL node representing the scene
	 *   output
	 */
	async build(callback: () => Node): Promise<void> {
		// Set this as the current canvas for auto-detection
		TSLScene2D._currentScene = this;

		if (!this.sceneObj) {
			this.sceneObj = new Scene();

			this.rendererObj = new WebGPURenderer({ forceWebGL: false });
			await this.rendererObj.init();
			this.rendererObj.outputColorSpace = SRGBColorSpace;
			this.rendererObj.setClearColor(new Color(0x808080));

			this.canvasEl = this.rendererObj.domElement;
			this.textureObj = new CanvasTexture(this.canvasEl);
			this.textureObj.colorSpace = NoColorSpace;
			this.textureObj.generateMipmaps = false;
			this.textureObj.minFilter = LinearFilter;
			this.textureObj.magFilter = LinearFilter;

			this.rendererObj.setSize(this._width, this._height);
			this.rendererObj.setPixelRatio(window.devicePixelRatio);

			this.planeGeometry = new PlaneGeometry(1, 1);
			this.planeMesh = new Mesh(this.planeGeometry, this.material);
			this.sceneObj.add(this.planeMesh);

			const planeSize = {
				w: this._width / 100,
				h: this._height / 100
			};
			this.planeMesh.scale.set(planeSize.w, planeSize.h, 1);

			this.cameraObj = new OrthographicCamera(
				-planeSize.w / 2,
				planeSize.w / 2,
				planeSize.h / 2,
				-planeSize.h / 2,
				0.1,
				2
			);
			this.cameraObj.position.z = 1;
		}

		this._drawCallback = callback;

		// Build the node graph ONCE and reuse it
		// RTTNodes (from convertToTexture) have updateBeforeType = NodeUpdateType.RENDER
		// which means they automatically re-render their content each frame
		if (!this._nodeGraphBuilt) {
			this._buildNodeGraph();
		}

		// Start rendering based on mode
		if (this._renderMode === "continuous") {
			this._startContinuousLoop();
		} else {
			// On-demand: render initial frame
			await this.renderFrame();
		}
	}

	/**
	 * Request a render on the next animation frame. In on-demand mode, this
	 * schedules a single render. In continuous mode, this is a no-op (rendering
	 * happens automatically).
	 */
	requestRender(): void {
		if (this._renderMode === "continuous") return;
		if (this._renderRequested) return;

		this._renderRequested = true;
		requestAnimationFrame(() => {
			this._renderRequested = false;
			void this.renderFrame();
		});
	}

	/** Render a single frame. Useful for manual frame-by-frame rendering. */
	async renderFrame(): Promise<void> {
		// Update fixed time if enabled
		if (this._fixedTime) {
			this._fixedTime.step();
		}

		// Build node graph if not already built
		if (!this._nodeGraphBuilt) {
			this._buildNodeGraph();
		}

		await this._updateUpdatableTextures();

		// Only render - node graph auto-updates
		if (this.rendererObj && this.sceneObj && this.cameraObj) {
			this.rendererObj.render(this.sceneObj, this.cameraObj);
		}

		if (this.textureObj) {
			this.textureObj.needsUpdate = true;
		}
	}

	/**
	 * Stop the continuous animation loop. Only relevant in continuous render
	 * mode.
	 */
	stopAnimationLoop(): void {
		if (this._animationFrameId !== null) {
			cancelAnimationFrame(this._animationFrameId);
			this._animationFrameId = null;
		}
	}

	/** Build the node graph from the build callback. */
	private _buildNodeGraph(): void {
		if (!this._drawCallback) return;

		const rawColorNode = this._drawCallback();
		let colorNode = rawColorNode;
		if (this.antialias === "smaa") {
			colorNode = smaa(rawColorNode);
		} else if (this.antialias === "fxaa") {
			colorNode = fxaa(rawColorNode);
		}
		this._currentColorNode = colorNode;
		this.material.colorNode = colorNode;
		this.material.needsUpdate = true;
		this._nodeGraphBuilt = true;
	}

	/**
	 * Force a rebuild of the node graph on the next frame. Use this when you
	 * need to change the node graph structure (not just uniform values). This
	 * will properly dispose all RTT render targets to prevent memory leaks.
	 */
	invalidateNodeGraph(): void {
		// Dispose old node graph resources before rebuilding
		if (this._currentColorNode) {
			this._disposeNodeGraph(this._currentColorNode);
			this._currentColorNode = null;
		}
		this._nodeGraphBuilt = false;
	}

	/**
	 * Traverse and dispose all RTTNode render targets in the node graph.
	 *
	 * @param node - The root node to start traversing from
	 */
	private _disposeNodeGraph(node: Node): void {
		const disposed = new Set<Node>();

		function disposeNode(n: Node): void {
			if (disposed.has(n)) return;
			disposed.add(n);

			// Check if this is an RTTNode and dispose its renderTarget
			const rttNode = n as RTTNodeLike;
			if (rttNode.isRTTNode && rttNode.renderTarget) {
				rttNode.renderTarget.dispose();
			}

			// Call dispose on the node itself (triggers 'dispose' event)
			n.dispose();
		}

		// Traverse the entire node graph
		node.traverse(disposeNode);
	}

	/**
	 * Dispose of all GPU resources, DOM elements, and cleanup event listeners.
	 * This should be called when the TSLScene2D instance is no longer needed
	 * to prevent memory leaks.
	 */
	dispose(): void {
		// Stop any ongoing rendering
		this.stopAnimationLoop();

		// Dispose of stats if present
		if (this.stats) {
			// Stats.js doesn't have a dispose method, but we can remove it from DOM
			const statsDom = this.stats.dom;
			if (statsDom.parentNode) {
				statsDom.parentNode.removeChild(statsDom);
			}
			this.stats = undefined;
		}

		// Dispose of the node graph
		if (this._currentColorNode) {
			this._disposeNodeGraph(this._currentColorNode);
			this._currentColorNode = null;
		}

		// Dispose of registered textures
		for (const texture of this.UpdatableTextures) {
			texture.dispose();
		}
		this.UpdatableTextures.clear();

		// Dispose of feedback textures
		for (const feedbackTexture of this.FeedbackTextures) {
			feedbackTexture.dispose();
		}
		this.FeedbackTextures.clear();

		// Dispose of Three.js objects
		if (this.planeGeometry) {
			this.planeGeometry.dispose();
			this.planeGeometry = null;
		}

		this.material.dispose();

		if (this.textureObj) {
			this.textureObj.dispose();
			this.textureObj = null;
		}

		if (this.planeMesh) {
			this.planeMesh = null; // Scene will handle disposal
		}

		if (this.sceneObj) {
			// Dispose of all objects in the scene
			while (this.sceneObj.children.length > 0) {
				const child = this.sceneObj.children[0];
				this.sceneObj.remove(child);
				if ("dispose" in child && typeof child.dispose === "function") {
					(child.dispose as () => void)();
				}
			}
			this.sceneObj = null;
		}

		// Dispose renderer
		if (this.rendererObj) {
			this.rendererObj.dispose();
			this.rendererObj = null;
		}

		// Clear references
		this.canvasEl = null;
		this.cameraObj = null;

		// Clear static reference if this was the current scene
		if (TSLScene2D._currentScene === this) {
			TSLScene2D._currentScene = null;
		}
	}

	/**
	 * Resume the continuous animation loop. Only relevant in continuous render
	 * mode.
	 */
	resumeAnimationLoop(): void {
		if (this._renderMode !== "continuous") {
			console.warn(
				"[TSLScene2D] resumeAnimationLoop() called in on-demand mode. Use requestRender() instead."
			);
			return;
		}
		if (this._animationFrameId !== null) {
			return; // Already running
		}

		this._startContinuousLoop();
	}

	/** Start the continuous animation loop (internal method). */
	private _startContinuousLoop(): void {
		function animate(this: TSLScene2D): void {
			void (async () => {
				// Update fixed time if enabled
				if (this._fixedTime) {
					this._fixedTime.update();
				}

				// Build node graph if not already built
				if (!this._nodeGraphBuilt) {
					this._buildNodeGraph();
				}

				await this._updateUpdatableTextures();

				// Only render - node graph is already built and RTTNodes auto-update
				if (this.rendererObj && this.sceneObj && this.cameraObj) {
					this.rendererObj.render(this.sceneObj, this.cameraObj);
				}

				if (this.textureObj) {
					this.textureObj.needsUpdate = true;
				}
				if (this.stats) {
					this.stats.update();
				}

				this._animationFrameId = requestAnimationFrame(boundAnimate);
			})();
		}

		const boundAnimate = animate.bind(this);
		this._animationFrameId = requestAnimationFrame(boundAnimate);
	}

	private async _updateUpdatableTextures(): Promise<void> {
		await this.updateTextures();
	}

	/**
	 * Set the FixedTime instance to use for time control. When set, the canvas
	 * will update the FixedTime on each frame.
	 *
	 * @param fixedTime - The FixedTime instance to use, or null to disable
	 */
	setFixedTime(fixedTime: FixedTime | null): void {
		this._fixedTime = fixedTime;
	}

	/**
	 * Get the current FixedTime instance.
	 *
	 * @returns The current FixedTime instance, or null if not set
	 */
	get fixedTime(): FixedTime | null {
		return this._fixedTime;
	}

	/**
	 * Update the size of the canvas and adjust camera/renderer accordingly.
	 *
	 * @param w - New width in pixels
	 * @param h - New height in pixels
	 */
	override setSize(w: number, h: number): void {
		super.setSize(w, h);

		if (
			!this.rendererObj ||
			!this.planeMesh ||
			!this.cameraObj ||
			!this.textureObj ||
			!this.canvasEl
		) {
			return;
		}

		this.rendererObj.setSize(w, h);
		this.rendererObj.setPixelRatio(window.devicePixelRatio);

		const newPlaneSize = { w: w / 100, h: h / 100 };
		this.planeMesh.scale.set(newPlaneSize.w, newPlaneSize.h, 1);

		this.cameraObj.left = -newPlaneSize.w / 2;
		this.cameraObj.right = newPlaneSize.w / 2;
		this.cameraObj.top = newPlaneSize.h / 2;
		this.cameraObj.bottom = -newPlaneSize.h / 2;
		this.cameraObj.updateProjectionMatrix();

		this.textureObj.needsUpdate = true;

		// Auto-render in on-demand mode after resize
		this.requestRender();
	}

	/**
	 * Get the current render mode.
	 *
	 * @returns The current rendering mode
	 */
	get renderMode(): RenderMode {
		return this._renderMode;
	}

	/**
	 * Get the canvas element.
	 *
	 * @returns The HTML canvas element
	 * @throws Error - If canvas is not initialized
	 */
	get canvasElement(): HTMLCanvasElement {
		if (!this.canvasEl) throwCanvasNotInitializedError("canvasElement");
		return this.canvasEl;
	}

	/**
	 * Get the canvas texture.
	 *
	 * @returns The CanvasTexture wrapping the renderer's canvas
	 * @throws Error - If texture is not initialized
	 */
	get texture(): CanvasTexture {
		if (!this.textureObj) throwCanvasNotInitializedError("texture");
		return this.textureObj;
	}

	/**
	 * Get the WebGPU renderer.
	 *
	 * @returns The WebGPURenderer instance
	 * @throws Error - If renderer is not initialized
	 */
	get renderer(): WebGPURenderer {
		if (!this.rendererObj) throwCanvasNotInitializedError("renderer");
		return this.rendererObj;
	}

	/**
	 * Get the Three.js scene.
	 *
	 * @returns The Scene instance
	 * @throws Error - If scene is not initialized
	 */
	get scene(): Scene {
		if (!this.sceneObj) throwCanvasNotInitializedError("scene");
		return this.sceneObj;
	}

	/**
	 * Get the orthographic camera.
	 *
	 * @returns The OrthographicCamera instance
	 * @throws Error - If camera is not initialized
	 */
	get camera(): OrthographicCamera {
		if (!this.cameraObj) throwCanvasNotInitializedError("camera");
		return this.cameraObj;
	}

	/**
	 * Get the plane mesh that displays the shader output.
	 *
	 * @returns The Mesh instance
	 * @throws Error - If mesh is not initialized
	 */
	get mesh(): Mesh {
		if (!this.planeMesh) throwCanvasNotInitializedError("mesh");
		return this.planeMesh;
	}
}
