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
import { DrawingContext, setDrawingContext } from "./drawing";
import Stats from "three/addons/libs/stats.module.js";

type MaterialWithColorNode = MeshBasicNodeMaterial & { colorNode: Node };

export class Canvas2D {
	// renderer / scene objects
	private sceneObj: THREE.Scene | null = null;
	private rendererObj: WebGPURenderer | null = null;
	private cameraObj: THREE.OrthographicCamera | null = null;
	private planeMesh: THREE.Mesh | null = null;
	private planeGeometry: THREE.PlaneGeometry | null = null;
	private canvasEl: HTMLCanvasElement | null = null;
	private textureObj: CanvasTexture | null = null;

	// drawing and material
	private drawingContext: DrawingContext;
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
		this.antialias = opts?.antialias ?? "fxaa";

		this._widthUniform = uniform(this._width);
		this._heightUniform = uniform(this._height);

		const outputNode = Fn(() => vec3(0));
		this.material = new MeshBasicNodeMaterial({
			colorNode: outputNode()
		}) as MaterialWithColorNode;

		this.drawingContext = new DrawingContext(width, height);
		setDrawingContext(this.drawingContext);

		if (opts?.stats) {
			this.stats = new Stats();
			document.body.appendChild(this.stats.dom);
		}
	}

	async draw(callback: () => Node) {
		if (!this.sceneObj) {
			this.sceneObj = new THREE.Scene();

			this.rendererObj = new WebGPURenderer({ forceWebGL: false });
			await this.rendererObj.init();
			this.rendererObj.outputColorSpace = THREE.SRGBColorSpace;
			this.rendererObj.setClearColor(new THREE.Color(0x808080));

			this.canvasEl = this.rendererObj.domElement;
			this.textureObj = new CanvasTexture(this.canvasEl);
			this.textureObj.colorSpace = THREE.SRGBColorSpace;

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

		const animate = () => {
			if (this._drawCallback) {
				const rawColorNode = this._drawCallback();
				let colorNode = rawColorNode;
				if (this.antialias === "smaa") {
					colorNode = smaa(rawColorNode);
				} else if (this.antialias === "fxaa") {
					colorNode = fxaa(rawColorNode);
				}
				this.material.colorNode = colorNode;
				this.material.needsUpdate = true;
			}

			if (this.rendererObj && this.sceneObj && this.cameraObj) {
				this.rendererObj.render(this.sceneObj, this.cameraObj);
			}

			if (this.textureObj) this.textureObj.needsUpdate = true;
			if (this.stats) this.stats.update();

			requestAnimationFrame(animate);
		};

		animate();
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

		this.drawingContext.resize(w, h);
		this.textureObj.needsUpdate = true;

		if (this._drawCallback) {
			const rawColorNode = this._drawCallback();
			let colorNode = rawColorNode;
			if (this.antialias === "smaa") {
				colorNode = smaa(rawColorNode);
			} else if (this.antialias === "fxaa") {
				colorNode = fxaa(rawColorNode);
			}
			this.material.colorNode = colorNode;
			this.material.needsUpdate = true;
		}
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
