import * as THREE from "three";
import {
	WebGPURenderer,
	Node,
	MeshBasicNodeMaterial,
	CanvasTexture,
	UniformNode
} from "three/webgpu";
import { Fn, vec3, uniform } from "three/tsl";
import { smaa } from "three/addons/tsl/display/SMAANode.js";
import { fxaa } from "three/addons/tsl/display/FXAANode.js";
import Stats from "three/addons/libs/stats.module.js";
import { FixedTime } from "../time/fixedTime";
import type { DynamicTexture } from "../textures/DynamicTexture";

type MaterialWithColorNode = MeshBasicNodeMaterial & { colorNode: Node };

// Type for RTTNode which has a renderTarget property
type RTTNodeLike = Node & {
	isRTTNode?: boolean;
	renderTarget?: THREE.RenderTarget;
};

export class Canvas2D {
	// renderer / scene objects
	private sceneObj: THREE.Scene | null = null;
	private rendererObj: WebGPURenderer | null = null;
	private cameraObj: THREE.OrthographicCamera | null = null;
	private planeMesh: THREE.Mesh | null = null;
	private planeGeometry: THREE.PlaneGeometry | null = null;
	private canvasEl: HTMLCanvasElement | null = null;
	private textureObj: CanvasTexture | null = null;

	// material
	private material: MaterialWithColorNode;

	// uniforms
	private _widthUniform: UniformNode<number>;
	private _heightUniform: UniformNode<number>;

	// misc
	private stats?: Stats;
	private _width: number;
	private _height: number;
	private antialias: "fxaa" | "smaa" | "none";
	private _drawCallback?: () => Node;
	private _animationFrameId: number | null = null;
	private _nodeGraphBuilt = false;
	private _currentColorNode: Node | null = null;
	private dynamicTextures = new Set<DynamicTexture>();

	// Time control
	private _fixedTime: FixedTime | null = null;

	// Static reference to current canvas for auto-detection
	private static _currentCanvas: Canvas2D | null = null;

	/**
	 * Get the currently active canvas (the one being drawn to)
	 */
	static get currentCanvas(): Canvas2D {
		if (!Canvas2D._currentCanvas) {
			throw new Error(
				"No active Canvas2D found. Make sure you're calling this within a canvas.draw() callback."
			);
		}
		return Canvas2D._currentCanvas;
	}

	private static configRenderer(
		renderer: WebGPURenderer,
		width: number,
		height: number,
		dpr: number
	) {
		renderer.setSize(width, height);
		renderer.setPixelRatio(dpr);
	}

	constructor(
		width: number,
		height: number,
		opts?: {
			stats?: boolean;
			antialias?: "fxaa" | "smaa" | "none";
		}
	) {
		this._width = width;
		this._height = height;
		this.antialias = opts?.antialias ?? "none";

		this._widthUniform = uniform(this._width);
		this._heightUniform = uniform(this._height);

		const outputNode = Fn(() => {
			return vec3(0);
		});
		this.material = new MeshBasicNodeMaterial({
			colorNode: outputNode()
		}) as MaterialWithColorNode;

		if (opts?.stats) {
			this.stats = new Stats();
			document.body.appendChild(this.stats.dom);
		}
	}

	async draw(callback: () => Node) {
		// Set this as the current canvas for auto-detection
		Canvas2D._currentCanvas = this;

		if (!this.sceneObj) {
			this.sceneObj = new THREE.Scene();

			this.rendererObj = new WebGPURenderer({ forceWebGL: false });
			await this.rendererObj.init();
			this.rendererObj.outputColorSpace = THREE.SRGBColorSpace;
			this.rendererObj.setClearColor(new THREE.Color(0x808080));

			this.canvasEl = this.rendererObj.domElement;
			this.textureObj = new CanvasTexture(this.canvasEl);
			this.textureObj.colorSpace = THREE.NoColorSpace;

			Canvas2D.configRenderer(
				this.rendererObj,
				this._width,
				this._height,
				window.devicePixelRatio
			);

			this.planeGeometry = new THREE.PlaneGeometry(1, 1);
			this.planeMesh = new THREE.Mesh(this.planeGeometry, this.material);
			this.sceneObj.add(this.planeMesh);

			const planeSize = {
				w: this._width / 100,
				h: this._height / 100
			};
			this.planeMesh.scale.set(planeSize.w, planeSize.h, 1);

			this.cameraObj = new THREE.OrthographicCamera(
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

		this._startAnimationLoop();
	}

	/**
	 * Render a single frame. Useful for manual frame-by-frame rendering.
	 */
	async renderFrame(): Promise<void> {
		// Update fixed time if enabled
		if (this._fixedTime) {
			this._fixedTime.step();
		}

		// Build node graph if not already built
		if (!this._nodeGraphBuilt) {
			this._buildNodeGraph();
		}

		await this._updateDynamicTextures();

		// Only render - node graph auto-updates
		if (this.rendererObj && this.sceneObj && this.cameraObj) {
			this.rendererObj.render(this.sceneObj, this.cameraObj);
		}

		if (this.textureObj) {
			this.textureObj.needsUpdate = true;
		}
	}

	/**
	 * Stop the animation loop.
	 */
	stopAnimationLoop(): void {
		if (this._animationFrameId !== null) {
			cancelAnimationFrame(this._animationFrameId);
			this._animationFrameId = null;
		}
	}

	/**
	 * Build the node graph from the draw callback.
	 */
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
	 * Force a rebuild of the node graph on the next frame.
	 * Use this when you need to change the node graph structure (not just uniform values).
	 * This will properly dispose all RTT render targets to prevent memory leaks.
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
	 */
	private _disposeNodeGraph(node: Node): void {
		const disposed = new Set<Node>();

		function disposeNode(n: Node) {
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
	 * Resume the animation loop.
	 */
	resumeAnimationLoop(): void {
		if (this._animationFrameId !== null) {
			return; // Already running
		}

		this._startAnimationLoop();
	}

	/**
	 * Start the animation loop (internal method).
	 */
	private _startAnimationLoop(): void {
		function animate(this: Canvas2D) {
			void (async () => {
				// Update fixed time if enabled
				if (this._fixedTime) {
					this._fixedTime.update();
				}

				// Build node graph if not already built
				if (!this._nodeGraphBuilt) {
					this._buildNodeGraph();
				}

				await this._updateDynamicTextures();

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

	registerDynamicTexture(texture: DynamicTexture): void {
		this.dynamicTextures.add(texture);
	}

	private async _updateDynamicTextures(): Promise<void> {
		if (!this.dynamicTextures.size) return;
		await Promise.all(
			Array.from(this.dynamicTextures, (tex) => {
				return tex.updateIfNeeded();
			})
		);
	}

	/**
	 * Set the FixedTime instance to use for time control.
	 * When set, the canvas will update the FixedTime on each frame.
	 */
	setFixedTime(fixedTime: FixedTime | null): void {
		this._fixedTime = fixedTime;
	}

	/**
	 * Get the current FixedTime instance.
	 */
	get fixedTime(): FixedTime | null {
		return this._fixedTime;
	}

	resize(w: number, h: number) {
		if (
			!this.rendererObj ||
			!this.planeMesh ||
			!this.cameraObj ||
			!this.textureObj ||
			!this.canvasEl
		) {
			return;
		}
		this._width = w;
		this._height = h;
		this._widthUniform.value = w;
		this._heightUniform.value = h;
		Canvas2D.configRenderer(
			this.rendererObj,
			w,
			h,
			window.devicePixelRatio
		);

		const newPlaneSize = { w: w / 100, h: h / 100 };
		this.planeMesh.scale.set(newPlaneSize.w, newPlaneSize.h, 1);

		this.cameraObj.left = -newPlaneSize.w / 2;
		this.cameraObj.right = newPlaneSize.w / 2;
		this.cameraObj.top = newPlaneSize.h / 2;
		this.cameraObj.bottom = -newPlaneSize.h / 2;
		this.cameraObj.updateProjectionMatrix();

		this.textureObj.needsUpdate = true;

		// Note: We don't rebuild the node graph on resize.
		// RTTNodes automatically resize via their autoResize feature.
	}

	get canvasElement(): HTMLCanvasElement {
		if (!this.canvasEl) throw new Error("Canvas not initialized");
		return this.canvasEl;
	}

	get texture(): CanvasTexture {
		if (!this.textureObj) throw new Error("Canvas not initialized");
		return this.textureObj;
	}

	get renderer(): WebGPURenderer {
		if (!this.rendererObj) throw new Error("Canvas not initialized");
		return this.rendererObj;
	}

	get scene(): THREE.Scene {
		if (!this.sceneObj) throw new Error("Canvas not initialized");
		return this.sceneObj;
	}

	get camera(): THREE.OrthographicCamera {
		if (!this.cameraObj) throw new Error("Canvas not initialized");
		return this.cameraObj;
	}

	get mesh(): THREE.Mesh {
		if (!this.planeMesh) throw new Error("Canvas not initialized");
		return this.planeMesh;
	}

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
		return this._width / this._height;
	}

	get aspectUniform(): Node {
		return this._widthUniform.div(this._heightUniform);
	}
}
