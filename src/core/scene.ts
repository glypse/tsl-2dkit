import * as THREE from "three";
import { WebGPURenderer, Node } from "three/webgpu";
import { Fn, vec3 } from "three/tsl";
import { MeshBasicNodeMaterial, CanvasTexture } from "three/webgpu";
import { type TSLMaterial } from "./materials";
import { DrawingContext, setDrawingContext } from "./drawing";
import Stats from "three/examples/jsm/libs/stats.module.js";

function configRenderer(
	renderer: WebGPURenderer,
	width: number,
	height: number,
	dpr: number
) {
	renderer.setSize(width, height);
	renderer.setPixelRatio(dpr);
}

async function Scene2D(
	width: number,
	height: number,
	TSLMaterial: TSLMaterial,
	forceWebGL = false,
	stats?: Stats
) {
	const scene = new THREE.Scene();
	let canvasElement: HTMLCanvasElement | null = null;
	let texture: CanvasTexture | null = null;

	const renderer = new WebGPURenderer({ forceWebGL, antialias: true });
	await renderer.init();
	renderer.outputColorSpace = THREE.SRGBColorSpace;
	renderer.setClearColor(new THREE.Color(0x808080));
	canvasElement = renderer.domElement;
	texture = new CanvasTexture(canvasElement);
	texture.colorSpace = THREE.SRGBColorSpace;

	const { material, resize: resizeMaterial } = TSLMaterial;

	configRenderer(renderer, width, height, window.devicePixelRatio * 1);

	const geometry = new THREE.PlaneGeometry(1, 1);
	const plane = new THREE.Mesh(geometry, material);
	scene.add(plane);

	const planeSize = { w: width / 100, h: height / 100 };

	plane.scale.set(planeSize.w, planeSize.h, 1);

	const camera = new THREE.OrthographicCamera(
		-planeSize.w / 2,
		planeSize.w / 2,
		planeSize.h / 2,
		-planeSize.h / 2,
		0.1,
		2
	);
	camera.position.z = 1;

	function onResize(newW: number, newH: number) {
		configRenderer(renderer, newW, newH, window.devicePixelRatio);
		const newPlaneSize = { w: newW / 100, h: newH / 100 };
		plane.scale.set(newPlaneSize.w, newPlaneSize.h, 1);
		camera.left = -newPlaneSize.w / 2;
		camera.right = newPlaneSize.w / 2;
		camera.top = newPlaneSize.h / 2;
		camera.bottom = -newPlaneSize.h / 2;
		camera.updateProjectionMatrix();
		resizeMaterial(newW, newH);
		if (texture && canvasElement) {
			canvasElement.width = newW;
			canvasElement.height = newH;
			texture.needsUpdate = true;
		}
	}

	const canvas = renderer.domElement;

	function onDrawScene(drawFn: () => void) {
		function animate() {
			drawFn();
			renderer.render(scene, camera);
			if (texture) texture.needsUpdate = true;
			if (stats) stats.update();
			requestAnimationFrame(animate);
		}
		animate();
	}

	return {
		canvas,
		texture,
		renderer,
		camera,
		scene,
		onDrawScene,
		onResize
	};
}

export class Canvas2D {
	private scene2D: Awaited<ReturnType<typeof Scene2D>> | null = null;
	private drawingContext: DrawingContext;
	private material: MeshBasicNodeMaterial & {
		colorNode: Node;
	};
	private stats?: Stats;
	private offscreen: boolean;
	private width: number;
	private height: number;

	constructor(
		width: number,
		height: number,
		opts?: { stats?: boolean; offscreen?: boolean }
	) {
		this.width = width;
		this.height = height;
		const outputNode = Fn(() => vec3(0));
		this.material = new MeshBasicNodeMaterial({
			colorNode: outputNode()
		}) as MeshBasicNodeMaterial & { colorNode: Node };
		this.drawingContext = new DrawingContext(width, height);
		setDrawingContext(this.drawingContext);

		this.offscreen = opts?.offscreen ?? false;

		if (opts?.stats) {
			this.stats = new Stats();
			document.body.appendChild(this.stats.dom);
		}
	}

	async draw(callback: () => Node) {
		if (!this.scene2D) {
			const baseMaterial = {
				material: this.material,
				draw: () => {
					// This function is given by the user
				},
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
				resize: (_w: number, _h: number) => {
					// TODO: implement resize logic
				}
			};
			this.scene2D = await Scene2D(
				this.width,
				this.height,
				baseMaterial,
				false,
				this.stats
			);
		}
		const colorNode = callback();
		this.material.colorNode = colorNode;
		this.material.needsUpdate = true;

		this.scene2D.onDrawScene(callback);
	}

	resize(w: number, h: number) {
		if (this.scene2D) {
			this.scene2D.onResize(w, h);
		}
	}

	get canvasElement(): Promise<HTMLCanvasElement> {
		if (this.offscreen)
			throw new Error("Offscreen canvas has no canvas element");
		if (this.scene2D) {
			return Promise.resolve(this.scene2D.canvas);
		} else {
			throw new Error("Canvas not initialized");
		}
	}

	get texture(): Promise<CanvasTexture> {
		if (this.scene2D) {
			return Promise.resolve(this.scene2D.texture);
		} else {
			throw new Error("Canvas not initialized");
		}
	}

	get renderer(): Promise<WebGPURenderer> {
		if (this.scene2D) {
			return Promise.resolve(this.scene2D.renderer);
		} else {
			throw new Error("Canvas not initialized");
		}
	}

	get scene(): Promise<THREE.Scene> {
		if (this.scene2D) {
			return Promise.resolve(this.scene2D.scene);
		} else {
			throw new Error("Canvas not initialized");
		}
	}

	get camera(): Promise<THREE.OrthographicCamera> {
		if (this.scene2D) {
			return Promise.resolve(this.scene2D.camera);
		} else {
			throw new Error("Canvas not initialized");
		}
	}
}
